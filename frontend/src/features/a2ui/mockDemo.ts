import { useSurfaceStore } from "./store.ts";

/**
 * Inject a demo surface to verify the renderer works without a backend.
 * Call from the browser console: `import('./features/a2ui/mockDemo').then(m => m.loadDemoSurface())`
 * Or invoke directly in development.
 */
export function loadDemoSurface(): void {
  const store = useSurfaceStore.getState();

  store.createSurface(
    "demo",
    "undefined-ai/edu-catalog",
    { primaryColor: "#6366f1", agentDisplayName: "undefined ai" },
    false,
  );

  store.updateComponents("demo", [
    { id: "root", component: "Column", children: ["header", "tabs_section"] },
    { id: "header", component: "Text", text: "Welcome to undefined ai", variant: "h1" },
    {
      id: "tabs_section",
      component: "Tabs",
      tabItems: [
        { title: { literalString: "Mind Map" }, child: "mindmap_card" },
        { title: { literalString: "Timeline" }, child: "timeline_card" },
        { title: { literalString: "Quiz" }, child: "quiz_card" },
        { title: { literalString: "Data Table" }, child: "table_card" },
      ],
    },
    { id: "mindmap_card", component: "Card", child: "mindmap_content" },
    { id: "mindmap_content", component: "MindMap", data: { path: "/mindmap" } },
    { id: "timeline_card", component: "Card", child: "timeline_content" },
    { id: "timeline_content", component: "Timeline", data: { path: "/timeline" } },
    { id: "quiz_card", component: "Card", child: "quiz_content" },
    { id: "quiz_content", component: "Quiz", data: { path: "/quiz" } },
    { id: "table_card", component: "Card", child: "table_content" },
    { id: "table_content", component: "DataTable", data: { path: "/table" } },
  ]);

  store.updateDataModel("demo", "/mindmap", {
    nodes: [
      { id: "1", label: "Quantum Computing", x: 250, y: 0 },
      { id: "2", label: "Qubits", x: 0, y: 120 },
      { id: "3", label: "Superposition", x: 250, y: 120 },
      { id: "4", label: "Entanglement", x: 500, y: 120 },
      { id: "5", label: "Quantum Gates", x: 125, y: 240 },
      { id: "6", label: "Quantum Algorithms", x: 375, y: 240 },
    ],
    edges: [
      { source: "1", target: "2" },
      { source: "1", target: "3" },
      { source: "1", target: "4" },
      { source: "2", target: "5" },
      { source: "3", target: "6" },
      { source: "4", target: "6" },
    ],
  });

  store.updateDataModel("demo", "/timeline", [
    { date: "1980", title: "Richard Feynman's proposal", description: "Feynman proposes simulating physics with quantum computers." },
    { date: "1994", title: "Shor's Algorithm", description: "Peter Shor discovers an algorithm for factoring integers on a quantum computer." },
    { date: "2019", title: "Quantum Supremacy", description: "Google claims quantum supremacy with their Sycamore processor." },
    { date: "2023", title: "Error Correction Milestones", description: "Major advances in quantum error correction codes." },
  ]);

  store.updateDataModel("demo", "/quiz", [
    {
      question: "What is a qubit?",
      options: [
        "A classical bit",
        "A quantum bit that can be in superposition",
        "A type of quantum gate",
        "A measurement unit",
      ],
      correctIndex: 1,
      explanation: "A qubit is the quantum analog of a classical bit. Unlike classical bits, qubits can exist in a superposition of 0 and 1 states simultaneously.",
    },
    {
      question: "What did Shor's algorithm solve?",
      options: [
        "Sorting large datasets",
        "Finding shortest paths",
        "Integer factorization",
        "Machine learning optimization",
      ],
      correctIndex: 2,
      explanation: "Shor's algorithm can factor large integers exponentially faster than the best known classical algorithms.",
    },
  ]);

  store.updateDataModel("demo", "/table", {
    headers: ["Concept", "Classical", "Quantum"],
    rows: [
      ["Basic unit", "Bit (0 or 1)", "Qubit (superposition)"],
      ["Parallelism", "Sequential", "Quantum parallelism"],
      ["Error rate", "Very low", "Higher, needs correction"],
      ["Speed advantage", "Baseline", "Exponential for some problems"],
    ],
  });
}
