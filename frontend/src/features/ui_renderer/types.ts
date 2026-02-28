export type UITheme = "light" | "dark" | "system";

export interface UISafeStyle {
    color?: string;
    background_color?: string;
    padding?: "none" | "sm" | "md" | "lg" | "xl";
    margin?: "none" | "sm" | "md" | "lg" | "xl" | "auto";
    width?: "auto" | "full" | "half" | "third";
    height?: "auto" | "full" | "screen";
    flex_grow?: 0 | 1;
}

export type UIAction =
    | { type: "navigate"; payload: { target_node_id: string } }
    | { type: "fetch"; payload: { endpoint: string; method: "GET" | "POST" } }
    | { type: "mutate"; payload: { target_id: string; update_path: string; new_value: any } }
    | { type: "generate_graph"; payload: { topic: string } }
    | { type: "open_modal"; payload: { target_modal_id: string } };

export interface UIEvents {
    onClick?: UIAction;
    onChange?: UIAction;
    onMount?: UIAction;
}

export interface UIBaseElement {
    type: string;
    style?: UISafeStyle;
    state?: "ready" | "loading" | "error" | "disabled";
    accessibility?: { aria_label?: string; alt_text?: string };
    events?: UIEvents;
    metadata?: Record<string, any>;
}

export interface UILinearLayout extends UIBaseElement {
    type: "linear_layout";
    orientation: "horizontal" | "vertical";
    children: string[];
}

export interface UIText extends UIBaseElement {
    type: "text";
    content: string;
    media_url?: string;
    media_type?: "image" | "video" | "audio";
}

export interface UITable extends UIBaseElement {
    type: "table";
    total_rows: number;
    total_columns: number;
    headers?: string[];
    cells: Record<string, string>; // e.g. "0_0": "root.cell_0_0"
}

export interface UIGraph extends UIBaseElement {
    type: "graph";
    layout_type?: "force" | "tree" | "grid";
    interactive?: boolean;
    selected_node_id?: string;
    children: string[]; // nodes and edges
}

export interface UINode extends UIBaseElement {
    type: "node";
    title: string;
    description: string;
    difficulty?: number;
    status?: "locked" | "available" | "completed";
}

export interface UIEdge extends UIBaseElement {
    type: "edge";
    left: string;
    right: string;
    direction: "left_to_right" | "right_to_left" | "bidirectional";
}

export interface UIQuiz extends UIBaseElement {
    type: "quiz";
    question: string;
    options: string[];
    answer: string;
    explanation?: string;
    difficulty?: number;
    max_attempts?: number;
    context_ids?: string[];
}

export interface UIButton extends UIBaseElement {
    type: "button";
    label: string;
}

export interface UIProgress extends UIBaseElement {
    type: "progress";
    value: number;
    max: number;
}

export interface UICodeBlock extends UIBaseElement {
    type: "code_block";
    language: string;
    content: string;
}

export interface UIModal extends UIBaseElement {
    type: "modal";
    children: string[];
}

export type UIElement =
    | UILinearLayout
    | UIText
    | UITable
    | UIGraph
    | UINode
    | UIEdge
    | UIQuiz
    | UIButton
    | UIProgress
    | UICodeBlock
    | UIModal;

export interface UIMeta {
    title?: string;
    description?: string;
    theme?: UITheme;
}

export interface UIJson {
    version: string;
    root_id: string;
    meta?: UIMeta;
    global_state?: Record<string, any>;
    patches?: Array<{
        op: "add" | "remove" | "update";
        target_id: string;
        patch_data?: Record<string, any>;
    }>;
    elements: Record<string, UIElement>;
}

export interface UIResponse {
    scene_id: string;
    topic_id: string;
    created_at: string;
    ui_json: UIJson;
}

export interface SseUIUpdateData {
    topic_id: string;
    scene_id: string;
    ui_json: UIJson;
}
