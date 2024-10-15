function onload({ extensionAPI, ...rest }) {
  console.log("Loaded learn english in roam");
}

function onunload() {
  console.log("Unloaded learn english in roam");
}

export default {
  onload: onload,
  onunload: onunload,
};
