pub mod persistence;

#[tauri::command]
pub async fn state_save(canvas: String) -> Result<(), String> {
    persistence::save_atomic(&canvas).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn state_load() -> Result<Option<String>, String> {
    persistence::load_state().map_err(|e| e.to_string())
}
