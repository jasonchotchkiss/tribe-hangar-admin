type ItemIconProps = {
    iconUrl?: string;
    name: string;
    size?: number;
};

export function ItemIcon({ iconUrl, name, size = 24 }: ItemIconProps) {
    if (iconUrl) {
        return (
            <img
                src={iconUrl}
                alt={name}
                style={{ width: size, height: size, flexShrink: 0 }}
                onError={(e) => {
                    // If image fails to load, replace with placeholder
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.removeAttribute("style");
                }}
            />
        );
    }

    // Placeholder when no icon available
    return (
        <div style={{
            width: size,
            height: size,
            backgroundColor: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: size * 0.5,
            color: "#555",
        }}>
            📦
        </div>
    );
}
