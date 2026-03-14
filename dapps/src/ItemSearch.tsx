import { useState, useEffect, useRef } from "react";
import { ItemIcon } from "./ItemIcon";

type ItemType = {
    id: number;
    name: string;
    iconUrl: string;
    groupName: string;
};

type ItemSearchProps = {
    onSelect: (typeId: string, name: string) => void;
    placeholder?: string;
};

export function ItemSearch({ onSelect, placeholder = "Search items..." }: ItemSearchProps) {
    const [allItems, setAllItems] = useState<ItemType[]>([]);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<ItemType[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadAllItems();
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function loadAllItems() {
        try {
            const response = await fetch(
                "https://world-api-stillness.live.tech.evefrontier.com/v2/types?limit=400&offset=0"
            );
            const data = await response.json();
            setAllItems(data.data);
        } catch (err) {
            console.error("Failed to load items:", err);
        } finally {
            setLoading(false);
        }
    }

    function handleSearch(value: string) {
        setQuery(value);
        if (value.length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }
        const filtered = allItems
            .filter(item => item.name.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 10);
        setResults(filtered);
        setIsOpen(filtered.length > 0);
    }

    function handleSelect(item: ItemType) {
        setQuery(item.name);
        setIsOpen(false);
        onSelect(item.id.toString(), item.name);
    }

    return (
        <div ref={containerRef} style={{ position: "relative", flex: 2 }}>
            <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => results.length > 0 && setIsOpen(true)}
                placeholder={loading ? "Loading items..." : placeholder}
                disabled={loading}
                style={{
                    width: "100%",
                    padding: "6px",
                    backgroundColor: "#111",
                    color: "#fff",
                    border: "1px solid #444",
                    fontFamily: "monospace",
                    fontSize: "11px",
                    boxSizing: "border-box",
                }}
            />
            {isOpen && results.length > 0 && (
                <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #444",
                    zIndex: 1000,
                    maxHeight: "200px",
                    overflowY: "auto",
                }}>
                    {results.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "6px 8px",
                                cursor: "pointer",
                                borderBottom: "1px solid #222",
                                fontFamily: "monospace",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2a2a2a")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                            <ItemIcon iconUrl={item.iconUrl} name={item.name} size={20} />
                            <div>
                                <div style={{ color: "#fff", fontSize: "12px" }}>{item.name}</div>
                                <div style={{ color: "#555", fontSize: "10px" }}>{item.groupName} · ID: {item.id}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
