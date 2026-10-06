async function test() {
  const url = "https://script.google.com/macros/s/AKfycbze6xFiB55FM4F2pvQmt75Kh7m4QwNVAzrKZ53EOy49FDFY4-ONbvGydU40d1w1TbbZ/exec";
  console.log("Fetching...");
  const res = await fetch(url);
  const text = await res.text();
  console.log("Response length:", text.length);
  console.log("Response:", text);
}

test();
