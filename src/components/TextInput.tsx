interface Props {
    text: string;
    setText: (term: string) => void;
    class?: string;
    id?: string;
    placeholder?: string;
    readonly?: boolean;
}

export default function TextInput(props: Props) {
    return (
        <input
            disabled={props.readonly}
            id={props.id}
            type="text"
            placeholder={props.placeholder || "Path..."}
            value={props.text}
            onInput={(e) => props.setText(e.currentTarget.value)}
            class={`v-input ${props.class ?? ""}`}
        />
    );
};
