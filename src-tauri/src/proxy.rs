use std::sync::Arc;
use tokio::sync::oneshot;
use warp::Filter;

/// Starts a local HTTP proxy that strips X-Frame-Options headers.
/// Returns the port the proxy is listening on.
pub async fn start_proxy() -> u16 {
    let client = Arc::new(
        reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::limited(10))
            .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15")
            .build()
            .expect("Failed to create HTTP client"),
    );

    let proxy = warp::path("proxy")
        .and(warp::query::<std::collections::HashMap<String, String>>())
        .and(warp::any().map(move || client.clone()))
        .and_then(handle_proxy);

    let (tx, rx) = oneshot::channel::<u16>();

    tokio::spawn(async move {
        // Bind to random available port
        let (addr, server) = warp::serve(proxy)
            .bind_ephemeral(([127, 0, 0, 1], 0));
        let _ = tx.send(addr.port());
        server.await;
    });

    rx.await.expect("Failed to get proxy port")
}

async fn handle_proxy(
    params: std::collections::HashMap<String, String>,
    client: Arc<reqwest::Client>,
) -> Result<impl warp::Reply, warp::Rejection> {
    let url = params
        .get("url")
        .cloned()
        .ok_or_else(warp::reject::not_found)?;

    match client.get(&url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Accept-Encoding", "identity")
        .send().await {
        Ok(resp) => {
            let status = resp.status().as_u16();
            let mut headers = warp::http::HeaderMap::new();

            for (key, value) in resp.headers() {
                let key_str = key.as_str().to_lowercase();
                // Strip headers that block iframe embedding
                if key_str == "x-frame-options"
                    || key_str == "content-security-policy"
                    || key_str == "x-content-security-policy"
                {
                    continue;
                }
                // Convert between http crate versions via string
                if let (Ok(k), Ok(v)) = (
                    warp::http::header::HeaderName::from_bytes(key.as_str().as_bytes()),
                    warp::http::HeaderValue::from_bytes(value.as_bytes()),
                ) {
                    headers.insert(k, v);
                }
            }

            // Allow embedding from our app
            headers.insert(
                warp::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
                warp::http::HeaderValue::from_static("*"),
            );

            let body = resp.bytes().await.unwrap_or_default();

            let mut response = warp::http::Response::builder()
                .status(status);

            for (key, value) in &headers {
                response = response.header(key, value);
            }

            Ok(response.body(body.to_vec()).unwrap())
        }
        Err(err) => {
            let response = warp::http::Response::builder()
                .status(502)
                .body(format!("Proxy error: {}", err).into_bytes())
                .unwrap();
            Ok(response)
        }
    }
}
