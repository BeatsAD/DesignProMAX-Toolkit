# 八语界面术语表

日期：2026-10-17。适用于 Figma 工程的界面、帮助、公告及错误提示。以下取自实际合并后的词典；简体中文源文案是查找键，英文列不作为其他语言的回退。

| 简体中文 | English | 日本語 | 한국어 | Français | Deutsch | Español | Português |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 一键抠图 | Remove Background | 背景を削除 | 배경 제거 | Supprimer le fond | Hintergrund entfernen | Eliminar fondo | Remover fundo |
| 裁剪透明 | Trim Transparency | 透明な余白を除去 | 투명 여백 자르기 | Rogner les bords transparents | Transparente Ränder entfernen | Recortar bordes transparentes | Recortar bordas transparentes |
| 图片分割 | Split Image | 画像を分割 | 이미지 분할 | Diviser l’image | Bild teilen | Dividir imagen | Dividir imagem |
| 文本填充 | Fill Text | テキストを一括入力 | 텍스트 채우기 | Remplir le texte | Text füllen | Rellenar texto | Preencher texto |
| 文本识别 | Extract Text | 文字を認識 | 텍스트 추출 | Extraire le texte | Text erkennen | Extraer texto | Extrair texto |
| 文本拆合 | Split & Merge Text | テキストを分割・結合 | 텍스트 나누기·합치기 | Diviser et fusionner le texte | Text teilen und verbinden | Dividir y unir texto | Dividir e unir texto |
| 图层清理 | Clean Up Layers | レイヤーを整理 | 레이어 정리 | Nettoyer les calques | Ebenen bereinigen | Limpiar capas | Limpar camadas |
| 文本替换 | Find & Replace | 検索と置換 | 찾기 및 바꾸기 | Rechercher et remplacer | Suchen und ersetzen | Buscar y reemplazar | Localizar e substituir |
| 数据统计 | Design Inventory | デザイン一覧 | 디자인 목록 | Inventaire du design | Design-Inventar | Inventario de diseño | Inventário de design |
| 尺寸适配 | Adapt Size | サイズを調整 | 크기 맞춤 | Adapter la taille | Größe anpassen | Adaptar tamaño | Adaptar tamanho |
| 图层 | Layer | レイヤー | 레이어 | Calque | Ebene | Capa | Camada |
| 当前画框 | Current frame | 現在のフレーム | 현재 프레임 | Cadre actuel | Aktueller Frame | Marco actual | Quadro atual |
| 当前选区 | Selection | 選択範囲 | 선택 영역 | Sélection | Auswahl | Selección | Seleção |
| 生成预览 | Generate preview | プレビュー作成 | 미리보기 생성 | Créer un aperçu | Vorschau erstellen | Generar vista previa | Gerar prévia |
| 确认执行 | Apply changes | 変更を適用 | 변경 적용 | Appliquer | Änderungen anwenden | Aplicar cambios | Aplicar alterações |
| 取消 | Cancel | キャンセル | 취소 | Annuler | Abbrechen | Cancelar | Cancelar |
| 撤销 | Undo | 元に戻す | 실행 취소 | Annuler la modification | Rückgängig | Deshacer | Desfazer |
| 重试 | Retry | 再試行 | 다시 시도 | Réessayer | Erneut versuchen | Reintentar | Tentar novamente |
| 保存 | Save | 保存 | 저장 | Enregistrer | Speichern | Guardar | Salvar |
| 合并 | Merge | 結合 | 합치기 | Fusionner | Verbinden | Unir | Unir |
| 左右拆分 | Split left/right | 左右に分割 | 좌우로 나누기 | Diviser en deux, gauche/droite | Links/rechts teilen | Dividir izquierda/derecha | Separar esquerda/direita |
| 上下拆分 | Split top/bottom | 上下に分割 | 상하로 나누기 | Diviser en deux, haut/bas | Oben/unten teilen | Dividir arriba/abajo | Separar cima/baixo |
| 复制全部 | Copy all | すべてコピー | 모두 복사 | Tout copier | Alles kopieren | Copiar todo | Copiar tudo |
| 全选 | Select all | すべて選択 | 모두 선택 | Tout sélectionner | Alle auswählen | Seleccionar todo | Selecionar tudo |
| 自定义字段 | Custom fields | カスタムフィールド | 사용자 지정 필드 | Champs personnalisés | Benutzerdefinierte Felder | Campos personalizados | Campos personalizados |
| 字段名称 | Field name | フィールド名 | 필드 이름 | Nom du champ | Feldname | Nombre del campo | Nome do campo |
| 平均置信度 | Average confidence | 平均信頼度 | 평균 신뢰도 | Confiance moyenne | Durchschnittliche Konfidenz | Confianza media | Confiança média |
| 设置 | Settings | 設定 | 설정 | Réglages | Einstellungen | Ajustes | Configurações |
| 常规设置 | General settings | 一般設定 | 일반 설정 | Réglages généraux | Allgemeine Einstellungen | Ajustes generales | Configurações gerais |
| 问题反馈 | Feedback | フィードバック | 피드백 | Commentaires | Feedback | Comentarios | Feedback |

## 使用约定

- 工具名称在首页、工具标题、帮助索引与公告中保持一致。按钮用动词，帮助中的按钮名称必须对应实际界面。
- 裁剪透明移除透明余白；图片分割生成独立区域；抠图通过外部服务移除背景。三者不可混称。
- 取消停止后续操作；撤销恢复已经完成的画布修改，二者不可互译。取消申请发出后仍等待执行回执。
- 未执行只用于已确认没有写入的情形；已返回成功数的操作应保留已完成数量；超时、未收到回执或恢复失败使用“结果待核对”，不能声称没有修改。
- 一般数量摘要用“标签：数量”的形式，避免 0、1、多项时套用同一个复数句式。保留全部占位符，允许各语言调整语序。
- 译文按各语言书写习惯使用句点、冒号与引号。日语使用礼貌说明体，韩语使用统一的敬语提示；西语使用一致的单数第二人称，葡语沿用当前巴西葡语常用表达（保留 pt 设置值）。
- 用户输入、图层与页面名称、字体名、密钥、OCR 识别结果和候选数据保持原文，不因切换语言改写。
- 自动覆盖与页面检查不能替代母语人工审校。本轮为 AI 逐项校对和语言润色，未取得母语审校人员签核。
