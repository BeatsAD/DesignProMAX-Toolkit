export const LANGUAGES=[['en','English'],['zh-CN','简体中文'],['ja','日本語'],['ko','한국어'],['fr','Français'],['de','Deutsch'],['es','Español'],['pt','Português']] as const;
export type Locale=typeof LANGUAGES[number][0];
// Each row is one complete phrase in en, zh-CN, ja, ko, fr, de, es, pt order.
const rows=`
Operation timed out. Retry when ready.|操作超时，请稍后重试。|処理がタイムアウトしました。再試行してください。|시간이 초과되었습니다. 다시 시도하세요.|Délai dépassé. Réessayez.|Zeitüberschreitung. Erneut versuchen.|Tiempo agotado. Reintenta.|Tempo esgotado. Tente novamente.
Enable image upload and save your own API key in Settings.|请在设置中允许图片上传并保存自己的密钥。|設定で画像のアップロードを許可し、APIキーを保存してください。|설정에서 이미지 업로드를 허용하고 API 키를 저장하세요.|Autorisez l’envoi et enregistrez votre clé dans les réglages.|Upload erlauben und eigenen API-Schlüssel speichern.|Permite subir imágenes y guarda tu clave en Ajustes.|Permita o envio e salve sua chave nas configurações.
This layer structure is not supported. Use an unrotated image outside instances and auto layout.|暂不支持此图层结构，请使用实例和自动布局外未旋转的图片。|インスタンスと自動レイアウトの外にある未回転の画像を使用してください。|인스턴스와 자동 레이아웃 밖의 회전하지 않은 이미지를 사용하세요.|Utilisez une image sans rotation hors instance et mise en page automatique.|Ein ungedrehtes Bild außerhalb von Instanzen und Auto-Layout verwenden.|Usa una imagen sin rotación fuera de instancias y diseño automático.|Use uma imagem sem rotação fora de instâncias e layout automático.
The layer or its parent is locked.|图层或其父级已锁定。|レイヤーまたは親がロックされています。|레이어 또는 상위 항목이 잠겨 있습니다.|Le calque ou son parent est verrouillé.|Ebene oder übergeordnetes Element gesperrt.|La capa o su padre está bloqueado.|A camada ou seu pai está bloqueado.
Some layers could not be changed. Review the result.|部分图层未能修改，请核对结果。|一部のレイヤーを変更できませんでした。結果を確認してください。|일부 레이어를 변경하지 못했습니다. 결과를 확인하세요.|Certains calques n’ont pas pu être modifiés.|Einige Ebenen konnten nicht geändert werden.|Algunas capas no se pudieron cambiar.|Algumas camadas não puderam ser alteradas.
Counts top-level frames and the selected object types.|统计顶层画框及所选类型对象。|最上位フレームと選択した種類のオブジェクトを集計します。|최상위 프레임과 선택한 유형의 개체를 집계합니다.|Compte les cadres racines et les types choisis.|Zählt oberste Frames und gewählte Objekttypen.|Cuenta marcos superiores y los tipos elegidos.|Conta quadros superiores e tipos selecionados.
Images|图片|画像|이미지|Images|Bilder|Imágenes|Imagens
Groups|分组|グループ|그룹|Groupes|Gruppen|Grupos|Grupos
Rectangles|矩形|長方形|사각형|Rectangles|Rechtecke|Rectángulos|Retângulos
No text detected|未识别到文字|テキストが見つかりません|텍스트를 찾지 못했습니다|Aucun texte détecté|Kein Text erkannt|No se detectó texto|Nenhum texto detectado
Delete|删除|削除|삭제|Supprimer|Löschen|Eliminar|Excluir
Frame|画框|フレーム|프레임|Cadre|Frame|Marco|Quadro
Component|组件|コンポーネント|컴포넌트|Composant|Komponente|Componente|Componente
Instance|实例|インスタンス|인스턴스|Instance|Instanz|Instancia|Instância
Section|分区|セクション|섹션|Section|Abschnitt|Sección|Seção
Tools|工具数量|ツール数|도구 수|Outils|Werkzeuge|Herramientas|Ferramentas
Home|首页|ホーム|홈|Accueil|Start|Inicio|Início
Settings|设置|設定|설정|Réglages|Einstellungen|Ajustes|Configurações
Help|帮助|ヘルプ|도움말|Aide|Hilfe|Ayuda|Ajuda
Feedback|问题反馈|フィードバック|피드백|Commentaires|Feedback|Comentarios|Feedback
Version|版本|バージョン|버전|Version|Version|Versión|Versão
Language|语言|言語|언어|Langue|Sprache|Idioma|Idioma
Choose your language|选择你的语言|言語を選択|언어 선택|Choisissez votre langue|Sprache auswählen|Elige tu idioma|Escolha seu idioma
You can change this later in Settings.|稍后可在设置中更改。|後で設定から変更できます。|나중에 설정에서 변경할 수 있습니다.|Modifiable dans les réglages.|Später in den Einstellungen änderbar.|Puedes cambiarlo en Ajustes.|Você pode alterar nas configurações.
Continue|确认并继续|確認して続行|확인하고 계속|Continuer|Weiter|Continuar|Continuar
Connecting…|正在连接…|接続中…|연결 중…|Connexion…|Verbindung…|Conectando…|Conectando…
Retry|重试|再試行|다시 시도|Réessayer|Erneut versuchen|Reintentar|Tentar novamente
Save|保存|保存|저장|Enregistrer|Speichern|Guardar|Salvar
Saved|已保存|保存済み|저장됨|Enregistré|Gespeichert|Guardado|Salvo
Cancel|取消|キャンセル|취소|Annuler|Abbrechen|Cancelar|Cancelar
Close|关闭|閉じる|닫기|Fermer|Schließen|Cerrar|Fechar
Apply changes|确认执行|変更を適用|변경 적용|Appliquer|Änderungen anwenden|Aplicar cambios|Aplicar alterações
Generate preview|生成预览|プレビュー作成|미리보기 생성|Créer un aperçu|Vorschau erstellen|Generar vista previa|Gerar prévia
Preview|预览|プレビュー|미리보기|Aperçu|Vorschau|Vista previa|Prévia
Before|修改前|変更前|변경 전|Avant|Vorher|Antes|Antes
After|修改后|変更後|변경 후|Après|Nachher|Después|Depois
Layer|图层|レイヤー|레이어|Calque|Ebene|Capa|Camada
Selection|当前选区|選択範囲|선택 영역|Sélection|Auswahl|Selección|Seleção
Current frame|当前画框|現在のフレーム|현재 프레임|Cadre actuel|Aktueller Frame|Marco actual|Quadro atual
Power utility|供电单位|電力会社|전력 회사|Fournisseur électrique|Stromversorger|Empresa eléctrica|Companhia elétrica
Date format|日期格式|日付形式|날짜 형식|Format de date|Datumsformat|Formato de fecha|Formato de data
Chinese date|中文日期|中国語の日付|중국어 날짜|Date en chinois|Chinesisches Datum|Fecha en chino|Data em chinês
YYYY-MM-DD|YYYY-MM-DD|YYYY-MM-DD|YYYY-MM-DD|YYYY-MM-DD|YYYY-MM-DD|YYYY-MM-DD|YYYY-MM-DD
YYYY/MM/DD|YYYY/MM/DD|YYYY/MM/DD|YYYY/MM/DD|YYYY/MM/DD|YYYY/MM/DD|YYYY/MM/DD|YYYY/MM/DD
Weekday|星期|曜日|요일|Jour de semaine|Wochentag|Día de la semana|Dia da semana
Current page|当前页面|現在のページ|현재 페이지|Page actuelle|Aktuelle Seite|Página actual|Página atual
All pages|所有页面|すべてのページ|모든 페이지|Toutes les pages|Alle Seiten|Todas las páginas|Todas as páginas
Scope|处理范围|対象範囲|처리 범위|Portée|Bereich|Ámbito|Escopo
Ready|已就绪|準備完了|준비됨|Prêt|Bereit|Listo|Pronto
Working…|正在处理…|処理中…|처리 중…|Traitement…|Wird verarbeitet…|Procesando…|Processando…
No matching layers|没有符合条件的图层|一致するレイヤーがありません|일치하는 레이어 없음|Aucun calque correspondant|Keine passenden Ebenen|Sin capas coincidentes|Nenhuma camada correspondente
Select layers on the canvas to begin.|请先在画布中选择图层。|キャンバスでレイヤーを選択してください。|캔버스에서 레이어를 선택하세요.|Sélectionnez des calques pour commencer.|Zum Start Ebenen auswählen.|Selecciona capas para empezar.|Selecione camadas para começar.
Changes applied|操作已完成|変更を適用しました|변경 적용됨|Modifications appliquées|Änderungen angewendet|Cambios aplicados|Alterações aplicadas
Confirm operation|确认操作|操作を確認|작업 확인|Confirmer l’opération|Vorgang bestätigen|Confirmar operación|Confirmar operação
Review the preview before applying. You can undo canvas changes.|执行前请核对预览，画布修改可以撤销。|適用前にプレビューを確認してください。変更は元に戻せます。|적용 전 미리보기를 확인하세요. 변경은 실행 취소할 수 있습니다.|Vérifiez l’aperçu. Les changements sont annulables.|Vorschau prüfen. Änderungen lassen sich rückgängig machen.|Revisa la vista previa. Los cambios se pueden deshacer.|Revise a prévia. As alterações podem ser desfeitas.
Browser test · sample document only|浏览器测试 · 仅操作示例文档|ブラウザテスト · サンプル文書のみ|브라우저 테스트 · 예제 문서만|Test navigateur · document exemple|Browsertest · nur Beispieldokument|Prueba web · solo documento de ejemplo|Teste no navegador · documento de exemplo
Sample canvas|示例画布|サンプルキャンバス|예제 캔버스|Canevas exemple|Beispiel-Leinwand|Lienzo de ejemplo|Tela de exemplo
Text samples|文本示例|テキスト例|텍스트 예제|Exemples de texte|Textbeispiele|Ejemplos de texto|Exemplos de texto
Transparent image|透明图片|透明画像|투명 이미지|Image transparente|Transparentes Bild|Imagen transparente|Imagem transparente
Image grid|卡片拼图|画像グリッド|이미지 격자|Grille d’images|Bilderraster|Cuadrícula de imágenes|Grade de imagens
Free layout|自由布局|自由配置|자유 레이아웃|Disposition libre|Freies Layout|Diseño libre|Layout livre
Cleanup samples|清理示例|クリーンアップ例|정리 예제|Exemples de nettoyage|Bereinigungsbeispiele|Ejemplos de limpieza|Exemplos de limpeza
Reset sample|重置示例|サンプルをリセット|예제 초기화|Réinitialiser l’exemple|Beispiel zurücksetzen|Restablecer ejemplo|Redefinir exemplo
Undo|撤销|元に戻す|실행 취소|Annuler la modification|Rückgängig|Deshacer|Desfazer
Upload image|上传本地图片|画像を読み込む|이미지 불러오기|Importer une image|Bild laden|Cargar imagen|Carregar imagem
Local processing|本地处理|ローカル処理|로컬 처리|Traitement local|Lokale Verarbeitung|Procesamiento local|Processamento local
External service|外部服务|外部サービス|외부 서비스|Service externe|Externer Dienst|Servicio externo|Serviço externo
Your everyday design work, simplified.|让日常设计工作更顺手。|毎日のデザイン作業をシンプルに。|일상의 디자인 작업을 간편하게.|Simplifiez votre travail de design.|Design-Alltag einfacher machen.|Simplifica tu trabajo de diseño.|Simplifique seu trabalho de design.
Tools for the small things that take time.|把耗时的小事交给工具。|時間のかかる小さな作業をツールに。|시간이 걸리는 작은 작업을 도구로.|Des outils pour les petites tâches chronophages.|Werkzeuge für zeitraubende Kleinigkeiten.|Herramientas para tareas que consumen tiempo.|Ferramentas para pequenas tarefas demoradas.
Image tools|图片工具|画像ツール|이미지 도구|Outils d’image|Bildwerkzeuge|Herramientas de imagen|Ferramentas de imagem
Text & data|文本与数据|テキストとデータ|텍스트 및 데이터|Texte et données|Text und Daten|Texto y datos|Texto e dados
Document tools|文档工具|ドキュメントツール|문서 도구|Document|Dokumentwerkzeuge|Documento|Documento
Remove Background|一键抠图|背景を削除|배경 제거|Supprimer le fond|Hintergrund entfernen|Eliminar fondo|Remover fundo
Trim Transparency|裁剪透明|透明な余白を除去|투명 여백 자르기|Rogner les bords transparents|Transparente Ränder entfernen|Recortar bordes transparentes|Recortar bordas transparentes
Split Image|图片分割|画像を分割|이미지 분할|Diviser l’image|Bild teilen|Dividir imagen|Dividir imagem
Fill Text|文本填充|テキストを一括入力|텍스트 채우기|Remplir le texte|Text füllen|Rellenar texto|Preencher texto
Extract Text|文本识别|文字を認識|텍스트 추출|Extraire le texte|Text erkennen|Extraer texto|Extrair texto
Split & Merge Text|文本拆合|テキストを分割・結合|텍스트 나누기·합치기|Diviser et fusionner le texte|Text teilen und verbinden|Dividir y unir texto|Dividir e unir texto
Clean Up Layers|图层清理|レイヤーを整理|레이어 정리|Nettoyer les calques|Ebenen bereinigen|Limpiar capas|Limpar camadas
Find & Replace|文本替换|検索と置換|찾기 및 바꾸기|Rechercher et remplacer|Suchen und ersetzen|Buscar y reemplazar|Localizar e substituir
Design Inventory|数据统计|デザイン一覧|디자인 목록|Inventaire du design|Design-Inventar|Inventario de diseño|Inventário de design
Adapt Size|尺寸适配|サイズを調整|크기 맞춤|Adapter la taille|Größe anpassen|Adaptar tamaño|Adaptar tamanho
Generate structured data, with a preview before every change.|按规则生成数据，每次修改前先预览。|規則に沿ってデータを生成し、変更前に確認。|규칙에 따라 데이터를 생성하고 변경 전 확인하세요.|Générez des données structurées avec aperçu.|Strukturierte Daten mit Vorschau erzeugen.|Genera datos estructurados con vista previa.|Gere dados estruturados com prévia.
Crop empty transparent pixels without uploading your image.|本地裁掉透明边，无需上传图片。|画像を送信せず透明な余白を除去。|업로드 없이 투명 여백을 자릅니다.|Rognez les pixels transparents sans envoi.|Transparente Ränder ohne Upload entfernen.|Recorta márgenes transparentes sin subir imágenes.|Recorte margens transparentes sem enviar imagens.
Separate image regions into individual PNG layers.|将图片区域拆成独立 PNG 图层。|画像領域を個別の PNG レイヤーに分割。|이미지 영역을 개별 PNG 레이어로 분할합니다.|Séparez les zones en calques PNG.|Bildbereiche in einzelne PNG-Ebenen teilen.|Separa regiones en capas PNG.|Separe regiões em camadas PNG.
Read Chinese and English text locally. Images stay on your device.|本地识别简中和英文，图片不离开设备。|中国語と英語をローカル認識。画像は送信しません。|중국어와 영어를 로컬에서 인식합니다. 이미지는 기기에 보관됩니다.|OCR chinois et anglais local, sans envoi.|Chinesisch und Englisch lokal erkennen, ohne Upload.|OCR local en chino e inglés, sin enviar imágenes.|OCR local em chinês e inglês, sem enviar imagens.
Split by delimiters or merge selected text in reading order.|按分隔符拆分，或按阅读顺序合并文本。|区切り文字で分割、または読み順で結合。|구분자로 분할하거나 읽기 순서로 병합합니다.|Divisez par séparateurs ou fusionnez dans l’ordre.|Nach Trennzeichen teilen oder in Lesereihenfolge verbinden.|Divide por separadores o une en orden de lectura.|Divida por separadores ou una na ordem de leitura.
Scan first. Review each candidate before deleting.|先扫描，核对候选项后再删除。|スキャン後、削除対象を確認。|먼저 검색하고 삭제 전 후보를 확인하세요.|Analysez puis vérifiez avant suppression.|Erst scannen, dann Löschkandidaten prüfen.|Escanea y revisa antes de eliminar.|Analise e revise antes de excluir.
Replace text or matched style ranges without overwriting other styles.|替换文字或命中的样式片段，保护其他样式。|他のスタイルを保護して文字やスタイル範囲を置換。|다른 스타일을 보호하며 텍스트나 스타일 범위를 바꿉니다.|Remplacez les plages sans écraser les autres styles.|Text oder Stilbereiche gezielt ersetzen.|Reemplaza rangos sin sobrescribir otros estilos.|Substitua intervalos sem sobrescrever outros estilos.
Count document objects by page and copy the inventory.|按页面统计对象并复制清单。|ページごとのオブジェクト一覧をコピー。|페이지별 개체 수를 세고 목록을 복사합니다.|Comptez les objets par page et copiez la liste.|Objekte pro Seite zählen und Liste kopieren.|Cuenta objetos por página y copia la lista.|Conte objetos por página e copie a lista.
Adapt existing layouts to new dimensions, with a risk preview.|调整现有布局尺寸，先查看变更与风险。|変更とリスクを確認して既存レイアウトを調整。|변경 및 위험을 미리 확인하고 레이아웃 크기를 맞춥니다.|Adaptez les dimensions avec aperçu des risques.|Layouts mit Risikovorschau anpassen.|Adapta dimensiones con vista previa de riesgos.|Adapte dimensões com prévia de riscos.
Uses your own API key. The external service may charge you.|使用自备密钥，外部服务可能收费。|ご自身の API キーを使用。外部サービスは有料の場合があります。|자신의 API 키를 사용합니다. 외부 서비스 요금이 부과될 수 있습니다.|Votre clé API ; le service peut être payant.|Eigener API-Schlüssel; Dienst kann Kosten verursachen.|Tu clave API; el servicio puede cobrarte.|Sua chave API; o serviço pode cobrar.
Field|填充字段|フィールド|필드|Champ|Feld|Campo|Campo
Name|姓名|氏名|이름|Nom|Name|Nombre|Nome
Phone|电话|電話|전화|Téléphone|Telefon|Teléfono|Telefone
Email|邮箱|メール|이메일|E-mail|E-Mail|Correo|E-mail
Company|公司|会社|회사|Entreprise|Firma|Empresa|Empresa
Address|地址|住所|주소|Adresse|Adresse|Dirección|Endereço
Region|省市区|地域|지역|Région|Region|Región|Região
Number|数字|数値|숫자|Nombre|Zahl|Número|Número
Date & time|日期时间|日時|날짜 및 시간|Date et heure|Datum und Uhrzeit|Fecha y hora|Data e hora
Custom|自定义|カスタム|사용자 지정|Personnalisé|Benutzerdefiniert|Personalizado|Personalizado
Sequence|顺序|連番|순서|Séquence|Reihenfolge|Secuencia|Sequência
Random range|区间随机|範囲内でランダム|범위 내 무작위|Plage aléatoire|Zufallsbereich|Rango aleatorio|Intervalo aleatório
Distribute total|总数分配|合計を分配|합계 분배|Répartir le total|Summe verteilen|Distribuir total|Distribuir total
Code|编码|コード|코드|Code|Code|Código|Código
Mode|模式|モード|모드|Mode|Modus|Modo|Modo
Start|起始值|開始値|시작값|Début|Startwert|Inicio|Início
Step|步长|間隔|간격|Pas|Schritt|Paso|Passo
Minimum|最小值|最小値|최솟값|Minimum|Minimum|Mínimo|Mínimo
Maximum|最大值|最大値|최댓값|Maximum|Maximum|Máximo|Máximo
Total|总数|合計|합계|Total|Summe|Total|Total
Decimal places|小数位|小数桁|소수 자릿수|Décimales|Dezimalstellen|Decimales|Casas decimais
Zero padding|整数补零位数|ゼロ埋め桁数|제로 패딩 자릿수|Zéros initiaux|Nullen auffüllen|Relleno con ceros|Preencher com zeros
Unit suffix|单位后缀|単位の接尾辞|단위 접미사|Suffixe d’unité|Einheitssuffix|Sufijo de unidad|Sufixo de unidade
Prefix|前缀|接頭辞|접두사|Préfixe|Präfix|Prefijo|Prefixo
Unique values|不重复|重複なし|중복 없음|Valeurs uniques|Eindeutige Werte|Valores únicos|Valores únicos
Mask personal data|数据脱敏|個人情報をマスク|개인정보 마스킹|Masquer les données|Daten maskieren|Ocultar datos personales|Mascarar dados pessoais
Use all selected text|填充全部选中文本|選択テキストすべてに適用|선택한 모든 텍스트에 적용|Tous les textes sélectionnés|Alle ausgewählten Texte|Todo el texto seleccionado|Todo o texto selecionado
Custom values, one per line|自定义内容，每行一项|カスタム値（1行1項目）|사용자 지정 값, 한 줄에 하나|Valeurs, une par ligne|Werte, einer pro Zeile|Valores, uno por línea|Valores, um por linha
Range start|范围开始|範囲の開始|범위 시작|Début de plage|Bereichsanfang|Inicio del rango|Início do intervalo
Range end|范围结束|範囲の終了|범위 끝|Fin de plage|Bereichsende|Fin del rango|Fim do intervalo
Day|天|日|일|Jour|Tag|Día|Dia
Hour|小时|時|시|Heure|Stunde|Hora|Hora
Minute|分钟|分|분|Minute|Minute|Minuto|Minuto
Second|秒|秒|초|Seconde|Sekunde|Segundo|Segundo
Year|年|年|년|Année|Jahr|Año|Ano
Month|月|月|월|Mois|Monat|Mes|Mês
Cycle|循环|繰り返し|반복|Cycle|Zyklus|Ciclo|Ciclo
Fixed|固定值|固定値|고정값|Fixe|Fest|Fijo|Fixo
Fixed value|固定内容|固定値|고정값|Valeur fixe|Fester Wert|Valor fijo|Valor fixo
Split|拆分|分割|분할|Diviser|Teilen|Dividir|Dividir
Merge|合并|結合|합치기|Fusionner|Verbinden|Unir|Unir
Delimiters|分隔符|区切り文字|구분자|Séparateurs|Trennzeichen|Separadores|Separadores
Separator|连接符|結合文字|연결 문자|Séparateur|Verbindungszeichen|Separador|Separador
Vertical|从上到下|縦方向|세로|Vertical|Vertikal|Vertical|Vertical
Left to right|从左到右|左から右|왼쪽에서 오른쪽|De gauche à droite|Von links nach rechts|De izquierda a derecha|Da esquerda para a direita
Gap|间距|間隔|간격|Espacement|Abstand|Espaciado|Espaçamento
Keep punctuation|保留标点|句読点を保持|문장부호 유지|Garder la ponctuation|Satzzeichen behalten|Conservar puntuación|Manter pontuação
Find|查找内容|検索|찾기|Rechercher|Suchen|Buscar|Localizar
Replace with|替换为|置換後|바꿀 내용|Remplacer par|Ersetzen durch|Reemplazar por|Substituir por
Text|文字|テキスト|텍스트|Texte|Text|Texto|Texto
Font|字体|フォント|글꼴|Police|Schrift|Fuente|Fonte
Font size|字号|文字サイズ|글꼴 크기|Taille de police|Schriftgröße|Tamaño de fuente|Tamanho da fonte
Color|颜色|色|색상|Couleur|Farbe|Color|Cor
Case sensitive|区分大小写|大文字と小文字を区別|대소문자 구분|Respecter la casse|Groß-/Kleinschreibung|Distinguir mayúsculas|Diferenciar maiúsculas
Include hidden text|包含隐藏文本|非表示テキストを含む|숨겨진 텍스트 포함|Inclure les textes masqués|Verborgenen Text einschließen|Incluir texto oculto|Incluir texto oculto
Source value|原始值|元の値|원본 값|Valeur source|Ausgangswert|Valor original|Valor original
Target value|目标值|変更後の値|대상 값|Valeur cible|Zielwert|Valor nuevo|Valor de destino
Hidden layers|隐藏图层|非表示レイヤー|숨겨진 레이어|Calques masqués|Verborgene Ebenen|Capas ocultas|Camadas ocultas
Empty text|空文本|空のテキスト|빈 텍스트|Texte vide|Leerer Text|Texto vacío|Texto vazio
Empty groups|空分组|空のグループ|빈 그룹|Groupes vides|Leere Gruppen|Grupos vacíos|Grupos vazios
Transparent layers|全透明图层|透明レイヤー|투명 레이어|Calques transparents|Transparente Ebenen|Capas transparentes|Camadas transparentes
Zero-size layers|零尺寸图层|サイズゼロ|크기가 0인 레이어|Taille nulle|Ebenen ohne Größe|Capas sin tamaño|Camadas sem tamanho
Outside frames|画板外对象|フレーム外の要素|프레임 외부 개체|Hors des cadres|Außerhalb von Frames|Fuera de marcos|Fora dos quadros
Width|宽度|幅|너비|Largeur|Breite|Ancho|Largura
Height|高度|高さ|높이|Hauteur|Höhe|Alto|Altura
Both axes|宽度和高度|幅と高さ|너비와 높이|Deux axes|Beide Achsen|Ambos ejes|Ambos os eixos
Axis|适配方向|調整方向|맞춤 방향|Axe|Achse|Eje|Eixo
Smart structure|智能结构适配|スマート構造|스마트 구조|Structure intelligente|Intelligente Struktur|Estructura inteligente|Estrutura inteligente
Explicit constraints|保守约束适配|明示的な制約|명시적 제약|Contraintes explicites|Explizite Bedingungen|Restricciones explícitas|Restrições explícitas
Strategy|适配策略|調整方法|맞춤 전략|Stratégie|Strategie|Estrategia|Estratégia
Moved|移动|移動|이동|Déplacé|Verschoben|Movido|Movido
Resized|调整尺寸|サイズ変更|크기 변경|Redimensionné|Größe geändert|Redimensionado|Redimensionado
Frozen|冻结保护|保護|보호됨|Protégé|Geschützt|Protegido|Protegido
Protected|已保护|保護対象|보호됨|Protégé|Geschützt|Protegido|Protegido
Detect regions|自动识别|領域を自動検出|영역 자동 감지|Détecter les zones|Bereiche erkennen|Detectar regiones|Detectar regiões
Cards|卡片|カード|카드|Cartes|Karten|Tarjetas|Cartões
Elements|元素|要素|요소|Éléments|Elemente|Elementos|Elementos
Rows|行数|行数|행 수|Lignes|Zeilen|Filas|Linhas
Columns|列数|列数|열 수|Colonnes|Spalten|Columnas|Colunas
Padding|留白|余白|여백|Marge|Rand|Margen|Margem
Read selected image|读取选中图片|選択画像を読む|선택 이미지 읽기|Lire l’image sélectionnée|Ausgewähltes Bild lesen|Leer imagen seleccionada|Ler imagem selecionada
Process image|处理图片|画像を処理|이미지 처리|Traiter l’image|Bild verarbeiten|Procesar imagen|Processar imagem
Insert new layers|插入新图层|新規レイヤーを挿入|새 레이어 삽입|Insérer des calques|Neue Ebenen einfügen|Insertar capas|Inserir camadas
Replace original|替换原图|元の画像を置換|원본 바꾸기|Remplacer l’original|Original ersetzen|Reemplazar original|Substituir original
Copy|复制|コピー|복사|Copier|Kopieren|Copiar|Copiar
Copied|已复制|コピー済み|복사됨|Copié|Kopiert|Copiado|Copiado
Result|处理结果|結果|결과|Résultat|Ergebnis|Resultado|Resultado
Service|处理服务|サービス|서비스|Service|Dienst|Servicio|Serviço
API key|API 密钥|API キー|API 키|Clé API|API-Schlüssel|Clave API|Chave API
Custom service URL|自定义服务地址|カスタムサービス URL|사용자 지정 서비스 URL|URL du service|Eigene Dienst-URL|URL de servicio|URL do serviço
Allow uploading selected images|允许上传选中图片|選択画像のアップロードを許可|선택 이미지 업로드 허용|Autoriser l’envoi des images sélectionnées|Upload ausgewählter Bilder erlauben|Permitir subir imágenes seleccionadas|Permitir envio de imagens selecionadas
Only the selected image is uploaded when you explicitly run this tool.|仅在主动执行时上传选中图片。|実行時のみ選択画像を送信します。|직접 실행할 때만 선택한 이미지를 업로드합니다.|L’image sélectionnée est envoyée uniquement à votre demande.|Nur bei ausdrücklicher Ausführung wird das Bild hochgeladen.|Solo se sube la imagen cuando ejecutas la herramienta.|A imagem só é enviada quando você executa a ferramenta.
Theme|主题|テーマ|테마|Thème|Design|Tema|Tema
Light|浅色|ライト|밝게|Clair|Hell|Claro|Claro
Dark|深色|ダーク|어둡게|Sombre|Dunkel|Oscuro|Escuro
Local settings only. Keys are not encrypted or included in feedback.|设置仅保存在本地，密钥不承诺加密，不包含在反馈中。|設定はローカル保存。キーの暗号化は保証せず、フィードバックに含めません。|설정은 로컬에 저장됩니다. 키 암호화는 보장되지 않으며 피드백에 포함되지 않습니다.|Réglages locaux. Clés non garanties chiffrées, exclues des retours.|Nur lokale Einstellungen. Schlüssel ohne Verschlüsselungszusage, nicht im Feedback.|Ajustes locales. Sin garantía de cifrado; claves excluidas de comentarios.|Configurações locais. Sem garantia de criptografia; chaves fora do feedback.
Contact & support|联系与支持|お問い合わせ|문의 및 지원|Contact et assistance|Kontakt und Support|Contacto y soporte|Contato e suporte
Source repository|开源仓库|ソースリポジトリ|소스 저장소|Dépôt source|Quellcode-Repository|Repositorio|Repositório
Free & open source · MIT|免费开源 · MIT|無料・オープンソース · MIT|무료 오픈 소스 · MIT|Gratuit et open source · MIT|Kostenlos und quelloffen · MIT|Gratis y código abierto · MIT|Gratuito e código aberto · MIT
Browser testing does not replace Figma host acceptance.|浏览器测试不能代替真实 Figma 验收。|ブラウザテストは Figma 実機検証の代わりになりません。|브라우저 테스트는 실제 Figma 검증을 대체하지 않습니다.|Le test navigateur ne remplace pas celui dans Figma.|Browsertests ersetzen keine Figma-Prüfung.|La prueba web no sustituye la validación en Figma.|O teste no navegador não substitui a validação no Figma.
Language applies to the interface. OCR supports Chinese and English; sample data stays unchanged.|语言仅影响界面。OCR 支持简中和英文，模拟数据保持原内容。|言語は UI のみ。OCR は中国語と英語、サンプルデータは変更しません。|언어는 UI에만 적용됩니다. OCR은 중국어와 영어를 지원하며 예제 데이터는 변경되지 않습니다.|La langue concerne l’interface. OCR chinois/anglais ; données inchangées.|Sprache gilt für die Oberfläche. OCR: Chinesisch/Englisch; Daten unverändert.|El idioma cambia la interfaz. OCR chino/inglés; datos sin cambios.|O idioma altera a interface. OCR chinês/inglês; dados inalterados.
Preview is out of date. Generate it again.|预览已过期，请重新生成。|プレビューが古くなりました。再作成してください。|미리보기가 오래되었습니다. 다시 생성하세요.|Aperçu périmé. Recréez-le.|Vorschau veraltet. Bitte neu erstellen.|Vista previa caducada. Genérala otra vez.|Prévia desatualizada. Gere novamente.
Select one supported image layer.|请选择一个受支持的图片图层。|対応する画像レイヤーを1つ選択してください。|지원되는 이미지 레이어 하나를 선택하세요.|Sélectionnez un calque image compatible.|Eine unterstützte Bildebene auswählen.|Selecciona una capa de imagen compatible.|Selecione uma camada de imagem compatível.
Image exceeds the size or pixel limit.|图片超过体积或像素限制。|画像がサイズまたは画素数の上限を超えています。|이미지가 크기 또는 픽셀 제한을 초과합니다.|L’image dépasse les limites.|Bild überschreitet Größen- oder Pixelgrenze.|La imagen supera los límites.|A imagem excede os limites.
Check the selection and parameters, then retry.|请检查选区和参数后重试。|選択範囲と設定を確認してください。|선택 영역과 매개변수를 확인하세요.|Vérifiez la sélection et les paramètres.|Auswahl und Parameter prüfen.|Revisa la selección y los parámetros.|Verifique a seleção e os parâmetros.
Operation cancelled|操作已取消|操作をキャンセルしました|작업 취소됨|Opération annulée|Vorgang abgebrochen|Operación cancelada|Operação cancelada
Unable to save or read settings. Your previous settings were not overwritten.|设置读取或保存失败，未覆盖原设置。|設定の読み書きに失敗しました。以前の設定は保持されます。|설정을 읽거나 저장할 수 없습니다. 이전 설정은 유지됩니다.|Lecture ou sauvegarde impossible. Réglages précédents préservés.|Einstellungen nicht les- oder speicherbar. Alte Werte bleiben erhalten.|No se pudieron leer o guardar los ajustes. Se conservan los anteriores.|Não foi possível ler ou salvar. Configurações anteriores preservadas.
External request failed. Check the service, key, network and CORS policy.|外部请求失败，请检查服务、密钥、网络和跨域设置。|外部リクエスト失敗。サービス、キー、ネットワークと CORS を確認。|외부 요청 실패. 서비스, 키, 네트워크 및 CORS를 확인하세요.|Échec externe. Vérifiez service, clé, réseau et CORS.|Externe Anfrage fehlgeschlagen. Dienst, Schlüssel, Netzwerk und CORS prüfen.|Falló la solicitud. Revisa servicio, clave, red y CORS.|Solicitação falhou. Verifique serviço, chave, rede e CORS.
Loading local OCR resources…|正在加载本地 OCR 资源…|ローカル OCR を読み込み中…|로컬 OCR 리소스 로드 중…|Chargement de l’OCR local…|Lokale OCR-Ressourcen laden…|Cargando OCR local…|Carregando OCR local…
Select a single free-layout container.|请选择一个自由布局容器。|自由配置のコンテナーを1つ選択してください。|자유 레이아웃 컨테이너 하나를 선택하세요.|Sélectionnez un conteneur libre.|Einen frei gestalteten Container auswählen.|Selecciona un contenedor de diseño libre.|Selecione um contêiner de layout livre.
No content is uploaded by local tools.|本地工具不会上传任何内容。|ローカルツールはコンテンツを送信しません。|로컬 도구는 콘텐츠를 업로드하지 않습니다.|Les outils locaux n’envoient aucun contenu.|Lokale Werkzeuge laden keine Inhalte hoch.|Las herramientas locales no suben contenido.|Ferramentas locais não enviam conteúdo.
Select all|全选|すべて選択|모두 선택|Tout sélectionner|Alle auswählen|Seleccionar todo|Selecionar tudo
Figma browser test|Figma 测试页|Figma ブラウザテスト|Figma 브라우저 테스트|Test navigateur Figma|Figma-Browsertest|Prueba de Figma en navegador|Teste do Figma no navegador
MasterGo interface and interactions are preserved. The sample document is for testing only.|保留 MasterGo 原界面与交互；示例文档仅用于测试。|MasterGo のUIと操作を維持。サンプルはテスト専用です。|MasterGo 화면과 조작을 유지합니다. 샘플 문서는 테스트 전용입니다.|Interface et interactions MasterGo conservées. Le document exemple sert au test.|MasterGo-Oberfläche und Bedienung bleiben erhalten. Beispieldokument nur zum Testen.|Se conservan interfaz e interacciones MasterGo. El documento es solo de prueba.|Interface e interações MasterGo mantidas. O documento é apenas para teste.
Default window|默认窗口|標準ウィンドウ|기본 창|Fenêtre par défaut|Standardfenster|Ventana predeterminada|Janela padrão
Expanded view|展开验证|拡大表示|펼친 보기|Vue agrandie|Erweiterte Ansicht|Vista ampliada|Vista ampliada
Plugin window|插件窗口|プラグインウィンドウ|플러그인 창|Fenêtre du plugin|Plugin-Fenster|Ventana del plugin|Janela do plugin
Figma plugin preview|Figma 插件预览|Figma プラグインプレビュー|Figma 플러그인 미리보기|Aperçu du plugin Figma|Figma-Plugin-Vorschau|Vista previa del plugin Figma|Prévia do plugin Figma
Choose your language in the plugin window.|请先在插件窗口确认语言。|プラグインで言語を選択してください。|플러그인 창에서 언어를 선택하세요.|Choisissez la langue dans le plugin.|Sprache im Plugin-Fenster auswählen.|Elige el idioma en la ventana del plugin.|Escolha o idioma na janela do plugin.
`;
export const CATALOG=Object.fromEntries(rows.trim().split('\n').map(line=>{const cols=line.split('|');if(cols.length!==8)throw new Error('Invalid translation row: '+cols[0]);return[cols[0],cols];})) as Record<string,string[]>;
export function translate(locale:string,key:string):string{return CATALOG[key]?.[Math.max(0,LANGUAGES.findIndex(l=>l[0]===locale))]??key;}
export const TOOL_NAMES={cutout:'Remove Background',transparentCrop:'Trim Transparency',imageSplit:'Split Image',textFill:'Fill Text',textRecognition:'Extract Text',textSplitMerge:'Split & Merge Text',cleanup:'Clean Up Layers',replace:'Find & Replace',statistics:'Design Inventory',sizeFit:'Adapt Size'} as const;
export const DESCRIPTIONS={cutout:'Uses your own API key. The external service may charge you.',transparentCrop:'Crop empty transparent pixels without uploading your image.',imageSplit:'Separate image regions into individual PNG layers.',textFill:'Generate structured data, with a preview before every change.',textRecognition:'Read Chinese and English text locally. Images stay on your device.',textSplitMerge:'Split by delimiters or merge selected text in reading order.',cleanup:'Scan first. Review each candidate before deleting.',replace:'Replace text or matched style ranges without overwriting other styles.',statistics:'Count document objects by page and copy the inventory.',sizeFit:'Adapt existing layouts to new dimensions, with a risk preview.'} as const;
