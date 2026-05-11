const actionHandlers = {
  NEXT_TAB: async () => moveToAdjacentTab(1),
  PREV_TAB: async () => moveToAdjacentTab(-1),
  GROUP_CURRENT_TAB: async (payload) => groupCurrentTab(payload?.title),
  SWITCH_GROUP: async (payload) => switchToGroupByTitle(payload?.title),
  SEARCH_TABS: async (payload) => searchTabs(payload?.query ?? ""),
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = actionHandlers[message?.type];
  if (!handler) {
    return false;
  }

  handler(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function moveToAdjacentTab(direction) {
  const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!current) return;

  const tabs = await chrome.tabs.query({ currentWindow: true });
  tabs.sort((a, b) => a.index - b.index);
  const currentIndex = tabs.findIndex((tab) => tab.id === current.id);
  if (currentIndex < 0) return;

  const target = tabs[(currentIndex + direction + tabs.length) % tabs.length];
  if (target?.id) {
    await chrome.tabs.update(target.id, { active: true });
  }
}

async function groupCurrentTab(title) {
  const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!current?.id) return;

  const groupId = await chrome.tabs.group({ tabIds: [current.id] });
  if (title?.trim()) {
    await chrome.tabGroups.update(groupId, { title: title.trim() });
  }
  return groupId;
}

async function switchToGroupByTitle(title) {
  const wanted = (title ?? "").trim().toLowerCase();
  if (!wanted) return;

  const groups = await chrome.tabGroups.query({});
  const match = groups.find((group) => (group.title ?? "").toLowerCase() === wanted);
  if (!match) return;

  const tabs = await chrome.tabs.query({ groupId: match.id });
  const first = tabs[0];
  if (first?.id) {
    await chrome.tabs.update(first.id, { active: true });
    await chrome.windows.update(first.windowId, { focused: true });
  }
}

async function searchTabs(query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const tabs = await chrome.tabs.query({});
  const matches = tabs.filter((tab) => {
    const title = (tab.title ?? "").toLowerCase();
    const url = (tab.url ?? "").toLowerCase();
    return title.includes(needle) || url.includes(needle);
  });

  const first = matches[0];
  if (first?.id) {
    await chrome.tabs.update(first.id, { active: true });
    await chrome.windows.update(first.windowId, { focused: true });
  }

  return matches.map((tab) => ({
    id: tab.id,
    title: tab.title,
    url: tab.url,
    groupId: tab.groupId,
  }));
}
