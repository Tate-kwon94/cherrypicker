import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * 열린 dialog 안에 키보드 포커스를 가둔다.
 *
 * `aria-modal="true"` 는 스크린리더에게 바깥을 무시하라고 약속하지만
 * 실제 포커스는 막지 않는다. 선언만 하고 가두지 않으면, 사용자는 모달에
 * 갇혔다고 믿는데 Tab 은 배경으로 넘어간다. 세 가지를 함께 한다:
 *   - 열릴 때 모달 안으로 초기 포커스
 *   - Tab / Shift+Tab 이 경계를 넘으면 반대쪽 끝으로 되돌리기
 *   - 닫을 때 열었던 요소로 포커스 복원
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    function focusable(): HTMLElement[] {
      return Array.from(container!.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
    }

    // 초기 포커스: 첫 포커스 가능한 요소, 없으면 컨테이너 자체.
    const first = focusable()[0];
    if (first) first.focus();
    else {
      container.tabIndex = -1;
      container.focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }
      const firstEl = elements[0];
      const lastEl = elements[elements.length - 1];
      const activeEl = document.activeElement;

      if (event.shiftKey && activeEl === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && activeEl === lastEl) {
        event.preventDefault();
        firstEl.focus();
      } else if (!container!.contains(activeEl)) {
        // 포커스가 어떻게든 밖으로 나갔으면 안으로 되돌린다.
        event.preventDefault();
        firstEl.focus();
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      // 복원: 열었던 요소가 아직 살아 있으면 그리로 포커스를 되돌린다.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active]);

  return containerRef;
}
