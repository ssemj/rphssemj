const url = "https://script.google.com/macros/s/AKfycbzm6fcZIr8gnraM-oJbADlfq-IV-QL38YJj0cjRkH42yHQn9L6vnm3Om2Q7Mz8ZYtru/exec";

async function fixServer() {
  console.log("Sending fix payload...");
  const payload = {
    logType: "MASTER_DATA_UPDATE",
    masterData: {
      subjects: [],
      hierarchy: {},
      classes: {},
      resources: [],
      dskpLinks: []
    }
  };

  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  console.log("Fix response:", text);
}

fixServer();
