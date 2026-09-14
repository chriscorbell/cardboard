import { customAlphabet } from "nanoid";

// URL-safe, lowercase, no ambiguous characters. 14 chars is plenty at this scale.
const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const gen = customAlphabet(alphabet, 14);

export function newId(): string {
  return gen();
}
