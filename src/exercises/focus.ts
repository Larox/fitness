export interface FocusRestoreState {
  key: string | null;
  selectionStart: number | null;
  selectionEnd: number | null;
}

export function focusRestoreKey(element: HTMLElement): string | null {
  const act = element.dataset.act;
  if (act) {
    const value = element.dataset.v;
    return value !== undefined ? `${act}:${value}` : act;
  }
  return element.id ? `#${element.id}` : null;
}

export function captureFocus(scope: ParentNode, bar?: ParentNode): FocusRestoreState {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) {
    return { key: null, selectionStart: null, selectionEnd: null };
  }
  const roots = [scope, bar].filter(Boolean) as ParentNode[];
  const contained = roots.some((root) => {
    if (root === document) {
      return true;
    }
    return root.contains(active);
  });
  if (!contained) {
    return { key: null, selectionStart: null, selectionEnd: null };
  }
  const key = focusRestoreKey(active);
  const input =
    active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? active
      : null;
  return {
    key,
    selectionStart: input?.selectionStart ?? null,
    selectionEnd: input?.selectionEnd ?? null,
  };
}

export function restoreFocus(
  state: FocusRestoreState,
  scope: ParentNode,
  bar?: ParentNode,
): void {
  if (!state.key) {
    return;
  }
  let el: HTMLElement | null = null;
  if (state.key.startsWith("#")) {
    el = document.getElementById(state.key.slice(1));
  } else {
    const colon = state.key.indexOf(":");
    const act = colon === -1 ? state.key : state.key.slice(0, colon);
    const value = colon === -1 ? undefined : state.key.slice(colon + 1);
    const selector =
      value !== undefined
        ? `[data-act="${act}"][data-v="${value}"]`
        : `[data-act="${act}"]`;
    const barScope = bar && (act === "save" || act === "delete");
    el =
      (barScope ? bar!.querySelector<HTMLElement>(selector) : null) ??
      scope.querySelector<HTMLElement>(selector);
  }
  if (!el) {
    return;
  }
  el.focus();
  if (
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
    state.selectionStart !== null &&
    state.selectionEnd !== null
  ) {
    el.setSelectionRange(state.selectionStart, state.selectionEnd);
  }
}