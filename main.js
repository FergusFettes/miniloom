// On page load, retrieve the API key from localStorage
document.addEventListener("DOMContentLoaded", function () {
  // Load data from localStorage on page load
  var savedData = localStorage.getItem("data");
  if (savedData) {
    data = JSON.parse(savedData);
    updateVisualization(Object.values(data.nodes));
  }
  // Hide the background text if there are nodes
  if (Object.keys(data.nodes).length > 0) {
    document.getElementById("background-text").style.display = "none";
  }
  const savedApiKey = localStorage.getItem("apiKey");
  if (savedApiKey) {
    const apiKeyInput = document.getElementById("api-key-input");
    apiKeyInput.value = savedApiKey.trim().replace(/^"|"$/g, "");
    apiKey = apiKeyInput.value;
    apiKeyInput.style.backgroundColor = "green";
  }
});

var dmp = new diff_match_patch();

var nodes = new vis.DataSet([]);
var edges = new vis.DataSet([]);

// Initialize data object to store nodes and edges
var data = { nodes: {}, edges: {} };

// Global variable to store the API key
var apiKey = "";
// Model configuration
// Global variable to track if model colors are enabled
var useModelColors = true;
var modelConfig = {
  model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
  max_tokens: 50,
  request_type: "language-model-inference",
  temperature: 0.7,
  top_p: 0.7,
  top_k: 50,
  repetition_penalty: 1,
  stream_tokens: false,
  stop: ["</s>"],
  n: 1,
};

// List of model aliases
var modelAliases = {
  "mistral-instruct": "mistralai/Mistral-7B-Instruct-v0.2",
  "mixtral-instruct": "mistralai/Mixtral-8x7B-Instruct-v0.1",
  mixtral: "mistralai/Mixtral-8x7B-v0.1",
  llama2: "togethercomputer/llama-2-70b",
  mistral: "mistralai/Mistral-7B-v0.1",
};

function cleanText(text) {
  // Remove everything up to and including the second plus sign in the text
  var plusIndex = text.indexOf("+");
  if (plusIndex >= 0) {
    text = text.substring(plusIndex + 1);
  }
  plusIndex = text.indexOf("+");
  if (plusIndex >= 0) {
    text = text.substring(plusIndex + 1);
  }
  return text;
}

// Function to update the visualization with new nodes
function updateVisualization(newNodes) {
  newNodes.forEach((node) => {
    // Use the last patch to set the label, if available
    const lastPatch =
      node.patches && node.patches.length > 0
        ? node.patches[node.patches.length - 1]
        : null;
    const label = lastPatch
      ? formatDiffsForDisplay(lastPatch.diffs)
      : node.text;
    const nodeColor = {
      border: getNodeBorderColor(node.type),
    };
    nodes.update({
      id: node.id,
      label: label,
      color: nodeColor,
      parent: node.parent,
    });
    if (node.parent !== null) {
      edges.update({ from: node.parent, to: node.id });
    }
  });
}

updateVisualization(Object.values(data.nodes));

function getNodeBorderColor(nodeType) {
  if (!useModelColors) {
    return "black"; // Return black when model colors are disabled
  }
  switch (nodeType) {
    case "mistral-instruct":
      return "blue";
    case "mixtral-instruct":
      return "green";
    case "mixtral":
      return "orange";
    case "llama2":
      return "purple";
    case "mistral":
      return "red";
    default:
      return "black"; // Default border color for unknown types
  }
}

// Helper function to check if there are any non-data nodes in the network
function hasNonDataNodes() {
  return (
    nodes.get({
      filter: function (node) {
        return node.group !== "data";
      },
    }).length > 0
  );
}

console.log("Processed nodes:", nodes);
console.log("Processed edges:", edges);

// Create a network
const container = document.getElementById("mynetwork");
const visData = {
  nodes: nodes,
  edges: edges,
};
const options = {
  layout: {
    hierarchical: {
      sortMethod: "directed",
      levelSeparation: 400,
      nodeSpacing: 250,
    },
  },
  nodes: {
    shape: "box",
    size: 20,
    color: {
      background: "white",
      border: "grey", // Default border color
      highlight: {
        background: "white",
        border: "black",
      },
    },
    font: {
      size: 20,
      multi: true, // Enable multi-line text
    },
    borderWidth: 2,
    widthConstraint: {
      maximum: 250,
    },
  },
  edges: {
    smooth: true,
    arrows: { to: true },
  },
  physics: { enabled: false },
};
const network = new vis.Network(container, visData, options);

// Check if nodes are empty and display background text
if (!hasNonDataNodes()) {
  document.getElementById("background-text").style.display = "flex";
} else {
  document.getElementById("background-text").style.display = "none";
}

// Event listener for the background text to open the modal on the first click
document
  .getElementById("background-text")
  .addEventListener("click", function () {
    if (!hasNonDataNodes()) {
      document.getElementById("background-text").style.display = "none";
      document.getElementById("textEditor").style.display = "block";
      document.getElementById("fullText").value =
        "(Right click to save and the editor!\nEscape to close without saving!)";
    }
  });

// Function to update the layout direction
function updateLayoutDirection(direction) {
  const options = {
    layout: {
      hierarchical: {
        direction: direction,
      },
    },
  };
  network.setOptions(options);
}

network.on("click", function (params) {
  if (params.nodes.length > 0) {
    // Check if the text editor is open
    nodeId = params.nodes[0];
    const textEditor = document.getElementById("textEditor");
    if (textEditor.style.display === "block") {
      const fullText = renderFullTextFromPatches(nodeId);

      // Update the full text in the editor
      const fullTextElement = document.getElementById("fullText");
      fullTextElement.value = fullText;
      // Ensure the text editor scrolls to the bottom after updates
      requestAnimationFrame(() => {
        fullTextElement.scrollTop = fullTextElement.scrollHeight;
      });
      fullTextElement.scrollTop = fullTextElement.scrollHeight;
      fullTextElement.setAttribute("data-node-id", nodeId);

      // Also, make the text editor no longer the active element.
      fullTextElement.blur();
    }

    // Save the last clicked node ID to localStorage
    localStorage.setItem("checkedOutNodeId", nodeId);
  }
});

// Event listener for node clicks to show full text in a modal
network.on("doubleClick", function (params) {
  if (params.nodes.length > 0) {
    const nodeId = params.nodes[0];
    const fullText = renderFullTextFromPatches(nodeId);

    // Display the full text in a modal
    const fullTextElement = document.getElementById("fullText");
    fullTextElement.value = fullText;
    // Ensure the text editor scrolls to the bottom after updates
    requestAnimationFrame(() => {
      fullTextElement.scrollTop = fullTextElement.scrollHeight;
    });
    fullTextElement.scrollTop = fullTextElement.scrollHeight;
    fullTextElement.setAttribute("data-node-id", nodeId);

    document.getElementById("textEditor").style.display = "block";
  }
});

// Function to create a new node if the text has changed or if it's the first node
function createNodeIfTextChanged(originalText, newText, parentId, type) {
  if (originalText !== newText || !hasNonDataNodes()) {
    // Text has changed, or it's the first node, create a new node
    const newNodeId = !hasNonDataNodes()
      ? 1
      : Object.keys(data.nodes).length + 1;
    const patches = dmp.patch_make(originalText, newText);
    data.nodes[newNodeId] = {
      id: newNodeId,
      text: dmp.patch_toText(patches),
      patches: patches,
      parent: parentId,
      type: type, // Store the type of the node
    };

    // if the parentId was nan, then the new node is the root and we must set the checked out node
    if (isNaN(parentId)) {
      localStorage.setItem("checkedOutNodeId", newNodeId);
      console.log("Checked out node ID:", newNodeId);
    }

    updateVisualization([data.nodes[newNodeId]]);
    // Save data to localStorage
    localStorage.setItem("data", JSON.stringify(data));
    // if type is human, select the new node
    if (type === "human") {
      network.selectNodes([newNodeId]);
      localStorage.setItem("checkedOutNodeId", newNodeId);
    }
    // Hide the background text when the first node is created
    document.getElementById("background-text").style.display = "none";
  }
}

// Modify the event listener for the modal to call createNodeIfTextChanged with human type
window.addEventListener("contextmenu", function (event) {
  const textEditor = document.getElementById("textEditor");
  const fullTextElement = document.getElementById("fullText");
  if (event.target === textEditor || event.target === fullTextElement) {
    // Get the current text from the modal
    const newText = fullTextElement.value;
    const nodeId = parseInt(fullTextElement.getAttribute("data-node-id"));
    const originalText = renderFullTextFromPatches(nodeId);

    // Create a new node if the text has changed with type as 'human'
    createNodeIfTextChanged(originalText, newText, nodeId, "human");

    // Ensure the text editor scrolls to the bottom after updates
    requestAnimationFrame(() => {
      fullTextElement.scrollTop = fullTextElement.scrollHeight;
    });
    // Close the modal
    textEditor.style.display = "none";
    fullTextElement.scrollTop = fullTextElement.scrollHeight;
    event.preventDefault(); // Prevent the default context menu from showing
  }
});

// Event listener for the Escape key to close the modal regardless of focus
window.addEventListener("keydown", function (event) {
  if (
    (event.key === "Escape" || event.keyCode === 27) &&
    document.getElementById("textEditor").style.display === "block"
  ) {
    document.getElementById("textEditor").style.display = "none";
  }
});

// Event listener for the 'p' key to open settings
window.addEventListener("keydown", function (event) {
  if (event.key === "p" || event.keyCode === 80) {
    // if the editor is open, do nothing
    if (document.getElementById("textEditor").style.display === "block") {
      return;
    }
    // Toggle the settings modal
    document.getElementById("settingsModal").style.display =
      document.getElementById("settingsModal").style.display === "block"
        ? "none"
        : "block";
  }
});

// Function to format diffs for display
function formatDiffsForDisplay(diffs) {
  const deletions = diffs
    .filter((diff) => diff[0] === -1)
    .map((diff) => diff[1])
    .join(" ")
    .trim();
  const additions = diffs
    .filter((diff) => diff[0] === 1)
    .map((diff) => diff[1])
    .join(" ")
    .trim();
  const delStr = deletions ? `-${deletions}` : "";
  const addStr = additions ? `+${additions}` : "";
  return `${delStr} ${addStr}`.trim();
}

// Function to render the full text from patches
function renderFullTextFromPatches(nodeId) {
  let currentNode = data.nodes[nodeId];
  let pathToRoot = [];
  let fullText = "";

  // Traverse up the tree to collect the path to the root
  while (currentNode) {
    pathToRoot.push(currentNode);
    currentNode = data.nodes[currentNode.parent];
  }

  // Reverse the path to start from the root
  pathToRoot.reverse();

  // Apply the patches from the root to the current node
  pathToRoot.forEach((node) => {
    if (node.patches) {
      // Apply the patch to the current full text
      const patches = node.patches;
      const results = dmp.patch_apply(patches, fullText);
      fullText = results[0]; // Update the full text with the applied patch
    }
  });

  return fullText;
}

// Event listener for the r key to generate new output
window.addEventListener("keydown", function (event) {
  if (event.key === "r" || event.keyCode === 82) {
    const fullTextElement = document.getElementById("fullText");
    // Check if the modal is open and focussed
    if (document.activeElement === fullTextElement) {
      return; // Exit the function if the modal is open
    }
    // Retrieve the last clicked node ID from localStorage
    const checkedOutNodeId = localStorage.getItem("checkedOutNodeId");
    console.log(nodes);

    if (checkedOutNodeId) {
      // Generate new output based on the checked-out node
      generateNewOutput(checkedOutNodeId);
    }
    event.preventDefault(); // Prevent the default action of the 'r' key
  }
});

// Function to generate new output based on the given text and parent ID
function generateNewOutput(parentId) {
  const fullText = renderFullTextFromPatches(parentId);
  // Collect all selected models
  const selectedModels = Array.from(
    document.querySelectorAll(".model-checkbox:checked"),
  ).map((checkbox) => checkbox.value);
  // Determine the number of generations to perform
  const generations = modelConfig.n || 1;
  // Call the function to make an API call for text generation for each selected model
  selectedModels.forEach((modelAlias) => {
    for (let i = 0; i < generations; i++) {
      generateText(fullText, parentId, modelAlias);
    }
  });
}

// Function to make an API call for text generation
function generateText(fullText, parentId, type) {
  const config = Object.assign({}, modelConfig); // Clone the modelConfig object
  config.prompt = fullText;
  // type is the model alias. set the name
  config.model = modelAliases[type];
  // Remove the 'n' parameter as it's not supported by the axios call
  delete config.n;
  axios({
    method: "post",
    url: "https://api.together.xyz/v1/completions",
    data: config,
    headers: {
      Authorization: "Bearer " + apiKey,
    },
    responseType: "text",
  })
    .then((response) => {
      // Remove the "data:" prefix if it exists and parse the JSON
      const responseData = response.data.replace(/^data: /, "");
      const jsonResponse = JSON.parse(responseData);
      const newText = " " + jsonResponse.choices[0].text;

      // Create a new node with the generated text and the model type
      createNodeIfTextChanged(fullText, fullText + newText, parentId, type);
    })
    .catch((error) => {
      console.error("Error during API call:", error);
    });
}

function downloadHTML() {
  var htmlContent = document.documentElement.outerHTML;
  htmlContent = htmlContent.replace(
    "var data = { nodes: {}, edges: {} };",
    "var data = " + JSON.stringify(data) + ";",
  );

  var blob = new Blob([htmlContent], { type: "text/html" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "index.html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Event listener for the "Download" button
document.getElementById("btn-download").addEventListener("click", downloadHTML);

// Event listener for API key input to change background color
document
  .getElementById("api-key-input")
  .addEventListener("input", function (event) {
    const input = event.target;
    apiKey = input.value.trim().replace(/^"|"$/g, "");
    if (apiKey !== "") {
      // Save the API key to localStorage
      localStorage.setItem("apiKey", apiKey);
      input.style.backgroundColor = "green";
    } else {
      input.style.backgroundColor = "pink";
    }
  });

// Event listener for model checkboxes to change model configuration
document.querySelectorAll(".model-checkbox").forEach((checkbox) => {
  checkbox.addEventListener("change", function (event) {
    const selectedModels = Array.from(
      document.querySelectorAll(".model-checkbox:checked"),
    ).map((checkbox) => checkbox.value);
    console.log("Selected models:", selectedModels);
  });
});
// Function to clear data from localStorage and reset visualization
function clearData() {
  localStorage.removeItem("data");
  data = { nodes: {}, edges: {} }; // Reset data object
  nodes.clear(); // Clear nodes from DataSet
  edges.clear(); // Clear edges from DataSet
  document.getElementById("background-text").style.display = "flex"; // Show background text
}

// Event listener for the 'Clear Data' button
document.getElementById("clear-data-btn").addEventListener("click", clearData);

// Event listener for the settings button to toggle the settings modal
document.getElementById("btn-settings").addEventListener("click", function () {
  const settingsModal = document.getElementById("settingsModal");
  settingsModal.style.display =
    settingsModal.style.display === "block" ? "none" : "block";
});

// Event listener for the toggle model colors checkbox
document
  .getElementById("toggle-model-colors")
  .addEventListener("change", function (event) {
    useModelColors = event.target.checked;
    updateVisualization(Object.values(data.nodes)); // Update the visualization with the new color setting
  });

// Event listener for the save settings button to update the model configuration
document
  .getElementById("save-settings-btn")
  .addEventListener("click", function () {
    modelConfig.max_tokens = parseInt(
      document.getElementById("max-tokens-input").value,
    );
    modelConfig.temperature = parseFloat(
      document.getElementById("temperature-input").value,
    );
    modelConfig.top_p = parseFloat(
      document.getElementById("top-p-input").value,
    );
    modelConfig.top_k = parseInt(document.getElementById("top-k-input").value);
    modelConfig.repetition_penalty = parseFloat(
      document.getElementById("repetition-penalty-input").value,
    );
    modelConfig.stop = [document.getElementById("stop-sequence-input").value];
    modelConfig.n = parseInt(
      document.getElementById("completions-input").value,
    );
    // Function to export JSON data to the textarea
  });

function exportJSON() {
  console.log(data);
  const jsonData = JSON.stringify(data, null, 2);
  document.getElementById("json-data-textarea").value = jsonData;
}
// Function to import JSON data from the textarea
function importJSON() {
  const jsonData = document.getElementById("json-data-textarea").value;
  try {
    const parsedData = JSON.parse(jsonData);
    document.getElementById("background-text").style.display = "none";
    // Update the data object and visualization with the new data
    data = parsedData;
    updateVisualization(Object.values(data.nodes));
  } catch (error) {
    console.error("Error parsing JSON:", error);
    alert("Invalid JSON data.");
  }
}

// Event listener for the export JSON button
document
  .getElementById("export-json-btn")
  .addEventListener("click", exportJSON);

// Event listener for the import JSON button
document
  .getElementById("import-json-btn")
  .addEventListener("click", importJSON);
// Close the settings modal
document.getElementById("settingsModal").style.display = "none";
console.log("Model configuration updated:", modelConfig);

// Event listener for right-click on the settings modal to close it
document
  .getElementById("settingsModal")
  .addEventListener("contextmenu", function (event) {
    this.style.display = "none";
    event.preventDefault(); // Prevent the default context menu
  });

// Function to find the parent node of the current node
function findParentNode(nodeId) {
  const node = nodes.get(nodeId);
  console.log("With parent:", node.parent);
  return node && node.parent ? node.parent : null;
}

// Function to find the left and right sibling nodes of the current node
function findSiblingNodes(nodeId) {
  const parentNodeId = findParentNode(nodeId);
  if (parentNodeId) {
    const siblings = nodes.get({
      filter: function (n) {
        return parseInt(n.parent) === parseInt(parentNodeId);
      },
    });
    const index = siblings.findIndex(
      (sibling) => parseInt(sibling.id) === parseInt(nodeId),
    );
    const leftSibling = index > 0 ? siblings[index - 1].id : null;
    const rightSibling =
      index < siblings.length - 1 ? siblings[index + 1].id : null;
    return { leftSibling, rightSibling };
  }
  return { leftSibling: null, rightSibling: null };
}

// Function to find the child node with the longest text from the currently selected node's children
function findLongestTextChildNode(parentNodeId) {
  let longestNode = null;
  let maxLength = 0;
  nodes.forEach(function (node) {
    if (parseInt(node.parent) === parseInt(parentNodeId)) {
      const length = node.label.length;
      if (length > maxLength) {
        longestNode = node.id;
        maxLength = length;
      }
    }
  });
  return longestNode;
}

// Event listener for the 'w', 'a', 'd', and 's' keys for navigation
window.addEventListener("keydown", function (event) {
  if (document.getElementById("textEditor").style.display === "block") {
    return; // Do not navigate if the text editor is open
  }
  const checkedOutNodeId = localStorage.getItem("checkedOutNodeId");
  let targetNodeId = null;
  switch (event.key) {
    case "w":
      targetNodeId = findParentNode(checkedOutNodeId);
      break;
    case "a":
      targetNodeId = findSiblingNodes(checkedOutNodeId).leftSibling;
      break;
    case "d":
      targetNodeId = findSiblingNodes(checkedOutNodeId).rightSibling;
      break;
    case "s":
      targetNodeId = findLongestTextChildNode(checkedOutNodeId);
      break;
  }
  console.log("Target node ID:", targetNodeId);
  if (targetNodeId !== null) {
    // instead of focusing on it, just make sure it is highlighted
    network.selectNodes([targetNodeId]);
    localStorage.setItem("checkedOutNodeId", targetNodeId); // Save the new checked-out node ID
  }
});
