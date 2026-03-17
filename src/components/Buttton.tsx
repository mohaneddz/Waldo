import { JSX } from 'solid-js';

interface Props {
  variant?: 'primary' | 'secondary' | 'basic' | 'danger' | 'ghost';
  children: JSX.Element;
  class?: string;
  title?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
}

export default function Button(props: Props) {
  const { variant = 'basic', onClick } = props;

  const getClass = () => {
    switch (variant) {
      case 'primary':
        return 'v-btn v-btn-primary';
      case 'secondary':
        return 'v-btn v-btn-secondary';
      case 'basic':
        return 'v-btn v-btn-basic';
      case 'danger':
        return 'v-btn v-btn-danger';
      case 'ghost':
        return 'v-btn v-btn-ghost';
      default:
        return 'v-btn v-btn-basic';
    }
  };

  return (
    <button
      type="button"
      class={`${getClass()} ${props.class ?? ''}`}
      disabled={props.disabled}
      onClick={onClick}
      title={props.title}
    >
      {props.children}
    </button>
  );
};
