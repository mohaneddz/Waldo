interface Props {
    number: string;
    setNumber: (term: string) => void;
    class?: string;
    id?: string;
    placeholder?: string;
    readonly?: boolean;
}

export default function NumberInput(props: Props) {
    return (
        <input
            disabled={props.readonly}
            id={props.id}
            type="number" // Changed input type to number
            placeholder={props.placeholder || "Duration..."}
            value={props.number}
            onInput={(e) => props.setNumber(e.currentTarget.value)}
            class={`text-sm pl-4 pr-4 py-2 bg-primary-light/40 border border-border-light-2 rounded-md text-white placeholder-white/70 focus:outline-none focus:border-accent ${props.class}`}
            min="0"
            step="1"
        />
    );
};
