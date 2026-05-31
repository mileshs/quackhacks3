import { toast } from "sonner";

const GAME_NOTICE_STORAGE_KEY = "quackhacks:gameEndNotice";

export function queueGameNotice(message: string) {
  window.localStorage.setItem(GAME_NOTICE_STORAGE_KEY, message);
}

export function flushQueuedGameNotice() {
  const message = window.localStorage.getItem(GAME_NOTICE_STORAGE_KEY);

  if (!message) {
    return;
  }

  window.localStorage.removeItem(GAME_NOTICE_STORAGE_KEY);
  showGameNotice(message);
}

export function showGameNotice(message: string) {
  toast(message, {
    duration: 4200
  });
}
