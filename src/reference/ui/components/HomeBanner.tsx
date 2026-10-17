import {Button} from './ui';
import {useBundledImage} from '../resources/useBundledImage';

export function HomeBanner({onOpenFeedback}:{onOpenFeedback?:()=>void}) {
  const {src,error,retry}=useBundledImage('designpromax-home-banner');
  return <>
    <button className="home-banner" data-localized-banner="true" type="button" aria-label="打开问题反馈" onClick={onOpenFeedback}>
      <img src={src} alt="" width={1212} height={404}/>
      <span className="localized-banner-copy" aria-hidden="true">
        <strong>免费设计工具箱</strong>
        <small>发现问题或有建议？欢迎联系我</small>
      </span>
    </button>
    {error ? <Button onClick={retry} size="compact">重新加载宣传图</Button> : null}
  </>;
}
