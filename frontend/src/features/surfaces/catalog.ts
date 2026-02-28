import { registerComponent } from "../a2ui/registry.ts";

import { A2UIText } from "./components/Text.tsx";
import { A2UIRow } from "./components/Row.tsx";
import { A2UIColumn } from "./components/Column.tsx";
import { A2UICard } from "./components/Card.tsx";
import { A2UIButton } from "./components/Button.tsx";
import { A2UITextField } from "./components/TextField.tsx";
import { A2UIDivider } from "./components/Divider.tsx";
import { A2UIImage } from "./components/ImageView.tsx";
import { A2UICheckBox } from "./components/CheckBox.tsx";
import { A2UITabs } from "./components/Tabs.tsx";
import { A2UIList } from "./components/ListComponent.tsx";
import { A2UIModal } from "./components/Modal.tsx";
import { A2UIMindMap } from "./components/MindMap.tsx";
import { A2UITimeline } from "./components/Timeline.tsx";
import { A2UIQuiz } from "./components/Quiz.tsx";
import { A2UIVideoPlayer } from "./components/VideoPlayer.tsx";
import { A2UIAudioPlayer } from "./components/AudioPlayer.tsx";
import { A2UIMarkdownView } from "./components/MarkdownView.tsx";
import { A2UIDataTable } from "./components/DataTable.tsx";
import { A2UIBadge } from "./components/Badge.tsx";
import { A2UIProgress } from "./components/Progress.tsx";
import { A2UIAvatar } from "./components/Avatar.tsx";
import { A2UISkeleton } from "./components/Skeleton.tsx";

/**
 * Register all A2UI components (basic catalog + educational extensions).
 * Call this once at app startup before any surfaces are rendered.
 */
export function registerAllComponents(): void {
  registerComponent("Text", A2UIText);
  registerComponent("Row", A2UIRow);
  registerComponent("Column", A2UIColumn);
  registerComponent("Card", A2UICard);
  registerComponent("Button", A2UIButton);
  registerComponent("TextField", A2UITextField);
  registerComponent("Divider", A2UIDivider);
  registerComponent("Image", A2UIImage);
  registerComponent("CheckBox", A2UICheckBox);
  registerComponent("Tabs", A2UITabs);
  registerComponent("List", A2UIList);
  registerComponent("Modal", A2UIModal);
  registerComponent("MindMap", A2UIMindMap);
  registerComponent("Timeline", A2UITimeline);
  registerComponent("Quiz", A2UIQuiz);
  registerComponent("Video", A2UIVideoPlayer);
  registerComponent("VideoPlayer", A2UIVideoPlayer);
  registerComponent("AudioPlayer", A2UIAudioPlayer);
  registerComponent("Markdown", A2UIMarkdownView);
  registerComponent("MarkdownView", A2UIMarkdownView);
  registerComponent("DataTable", A2UIDataTable);
  registerComponent("Table", A2UIDataTable);
  registerComponent("Badge", A2UIBadge);
  registerComponent("Progress", A2UIProgress);
  registerComponent("Avatar", A2UIAvatar);
  registerComponent("Skeleton", A2UISkeleton);

  // Lowercase aliases for fallback parser compatibility
  registerComponent("mindmap", A2UIMindMap);
  registerComponent("timeline", A2UITimeline);
  registerComponent("quiz", A2UIQuiz);
  registerComponent("video_player", A2UIVideoPlayer);
  registerComponent("markdown", A2UIMarkdownView);
  registerComponent("table", A2UIDataTable);
  registerComponent("badge", A2UIBadge);
  registerComponent("progress", A2UIProgress);
  registerComponent("avatar", A2UIAvatar);
  registerComponent("skeleton", A2UISkeleton);
}
