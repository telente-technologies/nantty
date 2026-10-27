import { findUsernameTags, splitTextByTags } from "../usernameTags.util";

const names = (text: string) => findUsernameTags(text).map((tag) => tag.username);

describe("findUsernameTags", () => {
  it("finds a tag at the start and middle", () => {
    expect(names("@sinach loves it, thanks @ada_1.x")).toEqual(["sinach", "ada_1.x"]);
  });
  it("ignores emails", () => {
    expect(names("write to me@nantty.com")).toEqual([]);
  });
  it("ignores URLs", () => {
    expect(names("see https://x.com/@sinach and a.com?u=@bob")).toEqual([]);
  });
  it("drops trailing punctuation", () => {
    expect(names("hi @sinach. ok (@bob), @eve!")).toEqual(["sinach", "bob", "eve"]);
  });
  it("never treats @all as a username", () => {
    expect(names("hey @all and @ALL, @alley")).toEqual(["alley"]);
  });
  it("rejects names longer than 30 characters", () => {
    expect(names(`@${"a".repeat(31)}`)).toEqual([]);
  });
});

describe("splitTextByTags", () => {
  it("lets entities win over overlapping parsed tags", () => {
    const segments = splitTextByTags("hey @sinach and @bob", [{ start: 4, length: 7 }]);
    expect(segments.map((segment) => [segment.text, segment.entity !== null, segment.username])).toEqual([
      ["hey ", false, null],
      ["@sinach", true, null],
      [" and ", false, null],
      ["@bob", false, "bob"],
    ]);
  });
});
