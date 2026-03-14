import { useUIStore } from "./store.ts";
import type { UIAction, UIEvents } from "./types.ts";
import { apiFetch } from "../../constants/api";

export async function handleAction(action: UIAction) {
    const store = useUIStore.getState();

    switch (action.type) {
        case "navigate":
            // In a real app this might use react-router, or change an active tab state
            // For now we'll update global_state to reflect active node if needed
            console.log(`Navigating to ${action.payload.target_node_id}`);
            store.updateGlobalState("active_node_id", action.payload.target_node_id);
            break;

        case "fetch":
            console.log(`Fetching ${action.payload.method} ${action.payload.endpoint}`);
            apiFetch(action.payload.endpoint, {
                method: action.payload.method,
            }).then(res => res.json()).then(data => {
                console.log("Fetch result:", data);
                // Dispatch updates back to UI if needed
            }).catch(err => {
                console.error("Fetch error:", err);
            });
            break;

        case "mutate":
            console.log("Mutating", action.payload);
            store.updateGlobalState(action.payload.update_path, action.payload.new_value);
            break;

        case "generate_graph":
            console.log(`Generating graph for topic: ${action.payload.topic}`);
            // Typically this would invoke an agent tool or endpoint
            // that returns SSE updates for the UI
            break;

        case "open_modal":
            console.log(`Opening modal: ${action.payload.target_modal_id}`);
            store.updateGlobalState("active_modal_id", action.payload.target_modal_id);
            break;

        default:
            console.warn("Unknown action type", action);
    }
}

export function generateEventHandlers(events?: UIEvents) {
    if (!events) return {};

    const handlers: Record<string, () => void> = {};

    if (events.onClick) {
        handlers.onClick = () => handleAction(events.onClick!);
    }
    if (events.onChange) {
        // For inputs we might want to pass the value instead, 
        // but the protocol just triggers the action
        handlers.onChange = () => handleAction(events.onChange!);
    }

    return handlers;
}
