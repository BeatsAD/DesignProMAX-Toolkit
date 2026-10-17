import type {PluginMessage} from './message-center';
export const pluginMessages:readonly PluginMessage[]=[{id:'figma-preview-welcome-v3',category:'announcement',title:'免费使用与持续维护',publishedAt:null,notify:true,sections:[{heading:'Figma 测试版',paragraphs:['DesignProMAX Toolkit 保留原工具箱的页面与交互，免费使用。当前仅在浏览器验收，尚未上架 Figma。']},{heading:'本地处理',paragraphs:['本地工具不上传图片。在线抠图需要自己的密钥及上传授权，外部服务可能收费。']},{heading:'问题反馈',paragraphs:['可点击首页宣传图进入问题反馈。']}]}];
export const pluginMessageIds=new Set(pluginMessages.map(item=>item.id));
