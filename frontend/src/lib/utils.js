import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() — merge Tailwind classes safely
 *
 * - clsx handles conditionals, arrays, objects
 * - twMerge resolves conflicts (e.g. "p-2 p-4" → "p-4")
 *
 * Usage:
 *   cn("px-3 py-2", isActive && "bg-indigo-50", "rounded-xl")
 *   cn("text-sm", isActive ? "text-indigo-600" : "text-gray-500")
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}