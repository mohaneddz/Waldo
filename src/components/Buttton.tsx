import { JSX } from 'solid-js';

interface Props {
  variant?: 'primary' | 'secondary' | 'basic' | 'danger' | 'ghost';
  children: JSX.Element;
  class?: string;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export default function Button(props: Props) {
  const { variant = 'basic', onClick } = props;

  const getClass = () => {
    switch (variant) {
      case 'primary':
        return 'rounded-md px-4 py-2 bg-secondary text-white border ';
      case 'secondary':
        return 'rounded-md px-4 py-2 bg-primary text-white border ';
      case 'basic':
        return 'border ';
      //   case 'danger':
      //     return '';
      case 'ghost':
        return 'rounded-md px-4 py-2 bg-transparent text-white border ';
      default:
        return '';
    }
  };

  return (
    <div
      class={`click inline-flex items-center justify-center font-bold text-center leading-none ` + getClass() + (props.disabled ? ' opacity-50 cursor-not-allowed ' : '') + props.class}
      onClick={!props.disabled ? onClick : undefined}
      title={props.title}
    >
      {props.children}
    </div>
  );
};
