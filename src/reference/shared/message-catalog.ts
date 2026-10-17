import type {PluginMessage} from './message-center';
export const pluginMessages:readonly PluginMessage[]=[{id:'figma-preview-welcome-v3',category:'announcement',title:'欢迎使用 DesignProMAX Toolkit',publishedAt:null,notify:true,sections:[{heading:'Figma 插件',paragraphs:['DesignProMAX Toolkit 提供文本批处理、图片处理和设计对象统计，插件免费使用。']},{heading:'本地处理',paragraphs:['本地工具不上传图片。在线抠图需要自己的密钥及上传授权，外部服务可能收费。']},{heading:'问题反馈',paragraphs:['可点击首页宣传图进入问题反馈。']}]}];
export const pluginMessageIds=new Set(pluginMessages.map(item=>item.id));
