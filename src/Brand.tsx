import light from './assets/logo-light.svg';
import dark from './assets/logo-dark.svg';
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={'brand-symbol ' + className} aria-hidden="true">
      <img className="logo-light" src={light} alt="" />
      <img className="logo-dark" src={dark} alt="" />
    </span>
  );
}
