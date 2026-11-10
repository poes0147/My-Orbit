const escapeText = (value: string) => value.replaceAll("\\", "\\\\")
  .replace(/\r\n|\r|\n/g, "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");

function fold(line: string) {
  const encoder = new TextEncoder();
  let bytes = 0;
  let folded = "";
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      folded += "\r\n ";
      bytes = 1;
    }
    folded += character;
    bytes += size;
  }
  return folded;
}

export function createVCard(profile: {
  name: string; headline?: string | null; bio?: string; email: string | null; phone: string | null; url?: string | null; organization?: string | null;
}) {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:" + escapeText(profile.name),
    "N:" + escapeText(profile.name) + ";;;;",
    profile.headline && "TITLE:" + escapeText(profile.headline),
    profile.email && "EMAIL;TYPE=INTERNET:" + escapeText(profile.email),
    profile.phone && "TEL;TYPE=CELL:" + escapeText(profile.phone),
    profile.url && "URL:" + escapeText(profile.url),
    profile.organization && "ORG:" + escapeText(profile.organization),
    profile.bio && "NOTE:" + escapeText(profile.bio),
    "END:VCARD",
  ].filter((line): line is string => Boolean(line)).map(fold).join("\r\n") + "\r\n";
}
