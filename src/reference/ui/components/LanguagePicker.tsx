import {useState} from 'react';
import {LANGUAGES,type Locale} from '../../../ui/i18n/catalog';
import {rpc} from '../../../ui/bridge';
import {setLocale,translateUi,useLocale} from '../../i18n';
import {SelectField} from './ui';

export function LanguagePicker() {
  const active=useLocale();
  const [pending,setPending]=useState(false);
  const [error,setError]=useState(false);

  async function choose(next:Locale) {
    setPending(true);
    setError(false);
    try {
      await rpc('SETTINGS_SAVE',{locale:next});
      setLocale(next);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return <div className="language-picker" aria-busy={pending}>
    <SelectField label="" placeholder={translateUi('语言')} value={active} disabled={pending} onChange={event=>void choose(event.target.value as Locale)}>
      {LANGUAGES.map(([code,name])=><option key={code} value={code}>{name}</option>)}
    </SelectField>
    {error&&<p role="alert">{translateUi('语言保存失败，请重试；原语言设置已保留。')}</p>}
  </div>;
}
