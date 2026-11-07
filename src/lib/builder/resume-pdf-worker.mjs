import { PDFParse } from "pdf-parse";

(async () => {
  const chunks = []; let size = 0;
  for await (const chunk of process.stdin) { size += chunk.length; if (size > 4194304) { process.stdout.write(JSON.stringify({ code: "INVALID_FORMAT" })); return; } chunks.push(chunk); }
  const parser = new PDFParse({ data: new Uint8Array(Buffer.concat(chunks)), isEvalSupported: false, verbosity: 0 });
  let result;
  try {
    const info = await parser.getInfo();
    if (info.total > 5) result = { code: "TOO_MANY_PAGES" };
    else {
      const output = await parser.getText({ pageJoiner: "\n" });
      const text = output.text.replace(/\u0000/g, "").trim();
      result = text.length < 50 ? { code: "NO_TEXT_FOUND" } : text.length > 8000 ? { code: "TEXT_TOO_LONG" } : { text };
    }
  } catch { result = { code: "INVALID_FORMAT" }; }
  finally {
    try { await parser.destroy(); } catch { result = { code: "INVALID_FORMAT" }; }
    process.stdout.write(JSON.stringify(result));
  }
})();
