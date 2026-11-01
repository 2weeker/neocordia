import { memo, useMemo } from 'react';
import { cipherAvatar } from './cipher';

type TCipherAvatarProps = { code: string; className?: string };

// Generated stand-in for a real avatar: a mirrored 5x5 pattern in the
// author's hue. Built from the opaque author code only.
const CipherAvatar = memo(({ code, className }: TCipherAvatarProps) => {
    const { hue, cells } = useMemo(() => cipherAvatar(code), [code]);

    return (
        <svg
            viewBox="0 0 5 5"
            aria-hidden="true"
            className={className}
            style={{ background: `hsl(${hue} 40% 18%)` }}
            shapeRendering="crispEdges"
        >
            {cells.flatMap((row, y) =>
                row.map((on, x) =>
                    on ? (
                        <rect
                            key={`${x}-${y}`}
                            x={x}
                            y={y}
                            width={1}
                            height={1}
                            fill={`hsl(${hue} 70% 62%)`}
                        />
                    ) : null
                )
            )}
        </svg>
    );
});

CipherAvatar.displayName = 'CipherAvatar';

export { CipherAvatar };
