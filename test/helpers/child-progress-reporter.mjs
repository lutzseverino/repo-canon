import { writeSync } from "node:fs";

// TAP's declaration order can hide a later file's progress. Send only live
// events over the runner's private pipe, leaving TAP and child output intact.
export default async function* progress(source) {
  for await (const { type, data } of source) {
    if (type === "test:dequeue" || type === "test:complete") {
      const { name, file, line, column, testId, entryFile } = data;
      writeSync(
        3,
        JSON.stringify({
          type,
          test: { name, file, line, column, testId, entryFile },
        }) + "\n",
      );
    } else if (type === "test:stdout" || type === "test:stderr") {
      writeSync(3, JSON.stringify({ type, message: data.message }) + "\n");
    }
  }
  yield "";
}
