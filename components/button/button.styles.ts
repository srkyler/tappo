export const buttonStyles = {
  base: "relative overflow-hidden transition-all duration-200 ease-in-out cursor-pointer font-courier font-bold tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white",
  variants: {
    primary: "bg-white text-black hover:bg-gray-200 hover:-translate-y-0.5 active:translate-y-0 active:bg-gray-300 shadow-sm hover:shadow-md",
    secondary: "bg-gray-800 text-white border border-gray-600 hover:bg-gray-700 hover:-translate-y-0.5 active:translate-y-0",
    ghost: "bg-transparent text-white border border-white/20 hover:bg-white/10 hover:-translate-y-0.5 active:translate-y-0",
  },
  sizes: {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  },
}
