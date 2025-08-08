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
            class={`text-sm pl-4 pr-4 py-2 bg-primary-light/40 border border-border-light-2 rounded-md text-white placeholder-white/70 focus:outline-none focus:border-accent ${props.class}`}
        />
    );
};
