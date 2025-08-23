import { writable } from "svelte/store";

export const currentPage = writable<number | null>(null);
