chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});