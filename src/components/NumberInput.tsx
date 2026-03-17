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
            type="number"
            placeholder={props.placeholder || "Duration..."}
            value={props.number}
            onInput={(e) => props.setNumber(e.currentTarget.value)}
            class={`v-input ${props.class ?? ""}`}
            min="0"
            step="1"
        />
    );
};
