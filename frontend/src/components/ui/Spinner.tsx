export function Spinner({ size = 'md', text }: { size?: 'sm' | 'md' | 'lg', text?: string }) {
    const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };

    return (
        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className={`${sizes[size]} animate-spin rounded-full border-2 border-slate-700 border-t-purple-500`}></div>
            {text && <p className="text-sm font-medium animate-pulse">{text}</p>}
        </div>
    );
}