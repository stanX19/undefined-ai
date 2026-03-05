// AST Node Types for MarkGraph

export interface Attr {
    name: string;
}

export interface RedirLink {
    type: "RedirLink";
    label: string;
    target: string;
    kind: "link" | "button";
}

export interface Include {
    type: "Include";
    label: string;
    target: string;
}

export interface TextNode {
    type: "TextNode";
    markdown: string;
    explicit_id?: string | null;
    fragments?: any[]; 
}

export interface GraphVertex {
    type: "GraphVertex";
    id: string;
    display: string;
    nav_target?: string | null;
}

export interface GraphEdge {
    type: "GraphEdge";
    src: string;
    op: "->" | "<-" | "--" | "<->";
    dst: string;
}

export interface GraphBlock {
    type: "GraphBlock";
    vertices: GraphVertex[];
    edges: GraphEdge[];
    explicit_id?: string | null;
}

export interface QuizBlock {
    type: "QuizBlock";
    question: string;
    answers: Array<[string, boolean]>; // [text, is_correct]
    explanation?: string | null;
    explicit_id?: string | null;
    user_answer_idx?: number | null; // Reactivity state
}

export interface CheckboxBlock {
    type: "CheckboxBlock";
    items: Array<[boolean, string]>; // [checked, text]
    explicit_id?: string | null;
}

export interface InputBlock {
    type: "InputBlock";
    question: string;
    placeholder?: string | null;
    explicit_id?: string | null;
    user_text: string; // Reactivity state
}

export interface ThresholdBody {
    type: "ThresholdBody";
    text?: string | null;
    include?: Include | null;
}

export interface Threshold {
    type: "Threshold";
    percent: number;
    body: ThresholdBody;
}

export interface ProgressBlock {
    type: "ProgressBlock";
    description?: string | null;
    value_fixed?: number | null;
    value_ids: string[];
    thresholds: Threshold[];
    explicit_id?: string | null;
}

export type MarkGraphElement =
    | RedirLink
    | Include
    | TextNode
    | GraphBlock
    | QuizBlock
    | CheckboxBlock
    | InputBlock
    | ProgressBlock;

export interface Container {
    type: "Container";
    id: string;
    depth: number;
    attrs: Attr[];
    children: Array<Container | MarkGraphElement>;
    raw_heading: string;
}

export interface Scene {
    type: "Scene";
    id: string;
    attrs: Attr[];
    children: Array<Container | MarkGraphElement>;
    raw_heading: string;
}

export interface MarkGraphAST {
    version: string;
    scenes: Scene[];
    id_map: Record<string, any>;
}
