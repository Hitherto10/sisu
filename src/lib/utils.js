import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Debounce helper
export function debounce(func, wait) {
    let timeout;

    const executedFunction = function(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };

    executedFunction.cancel = () => {
        clearTimeout(timeout);
    };

    return executedFunction;
}