export const RISK_ROWS=`
图层“%1”%2，已冻结该区域并继续处理其余安全内容。|Layer “%1”: %2. This region was frozen; safe content can proceed.|レイヤー「%1」：%2。この領域を固定し、安全な内容を処理します。|레이어 “%1”: %2. 이 영역은 고정하고 안전한 내용만 처리합니다.|Calque « %1 » : %2. Zone figée, le contenu sûr continue.|Ebene „%1“: %2. Bereich eingefroren; sichere Inhalte werden verarbeitet.|Capa «%1»: %2. Área congelada; continúa el contenido seguro.|Camada “%1”: %2. Área congelada; conteúdo seguro continua.
图层“%1”扩大后内部内容保持固定，请确认新增留白符合预期。|Layer “%1” grows while its content stays fixed; review the extra space.|「%1」は内部を保って拡大します。増えた余白を確認してください。|“%1”은 내용이 고정된 채 커집니다. 추가 여백을 확인하세요.|« %1 » s’agrandit sans déplacer son contenu ; vérifiez l’espace ajouté.|„%1“ wächst bei festem Inhalt; zusätzlichen Freiraum prüfen.|«%1» crece con contenido fijo; revisa el espacio añadido.|“%1” cresce com conteúdo fixo; revise o espaço adicional.
图层“%1”的宽度限制与当前尺寸不一致，已忽略失效元数据。|Layer “%1” has stale width limits; invalid metadata was ignored.|「%1」の幅制限が現在サイズと不一致のため無効データを無視しました。|“%1”의 너비 제한이 현재 크기와 달라 무효 데이터를 무시했습니다.|Limites de largeur de « %1 » obsolètes ; métadonnées ignorées.|Veraltete Breitenlimits von „%1“ ignoriert.|Límites de ancho obsoletos de «%1» ignorados.|Limites de largura antigos de “%1” ignorados.
图层“%1”的高度限制与当前尺寸不一致，已忽略失效元数据。|Layer “%1” has stale height limits; invalid metadata was ignored.|「%1」の高さ制限が現在サイズと不一致のため無効データを無視しました。|“%1”의 높이 제한이 현재 크기와 달라 무효 데이터를 무시했습니다.|Limites de hauteur de « %1 » obsolètes ; métadonnées ignorées.|Veraltete Höhenlimits von „%1“ ignoriert.|Límites de alto obsoletos de «%1» ignorados.|Limites de altura antigos de “%1” ignorados.
图层“%1”的计划尺寸超出有效限制，已冻结该区域并继续处理其余安全内容。|Layer “%1” would exceed valid size limits; freeze it and continue safe regions.|「%1」がサイズ制限を超えるため固定し、安全な領域を処理します。|“%1”의 예정 크기가 한도를 초과하여 고정하고 안전한 영역만 처리합니다.|« %1 » dépasserait les limites ; zone figée, les autres continuent.|„%1“ würde Größenlimits überschreiten; einfrieren und sichere Bereiche weiterverarbeiten.|«%1» superaría límites; se congela y continúan áreas seguras.|“%1” excederia limites; fica congelada e áreas seguras continuam.
%1 个未配置约束的图层保持原位置和尺寸。|%1 unconstrained layers keep their original position and size.|制約のない %1 レイヤーは元位置・サイズを維持します。|제약이 없는 레이어 %1개는 원래 위치와 크기를 유지합니다.|%1 calques sans contraintes gardent position et taille.|%1 Ebenen ohne Einschränkungen behalten Position und Größe.|%1 capas sin restricciones conservan posición y tamaño.|%1 camadas sem restrições mantêm posição e tamanho.
已按同级结构关系规划 %1 个图层；执行前请核对预览统计。|Planned %1 layers using sibling relationships; review preview statistics before applying.|同階層の関係で %1 レイヤーを計画。実行前に統計を確認してください。|동일 수준 관계로 레이어 %1개를 계획했습니다. 실행 전 통계를 확인하세요.|%1 calques planifiés selon leurs relations ; vérifiez l’aperçu avant application.|%1 Ebenen anhand ihrer Beziehungen geplant; Vorschau vor Anwendung prüfen.|%1 capas planificadas según relaciones; revisa estadísticas antes de aplicar.|%1 camadas planejadas conforme relações; revise estatísticas antes de aplicar.
已统一 %1 行表格的 %2 个列边界。|Aligned %2 column boundaries across %1 rows.|%1 行の %2 列境界を揃えました。|%1개 행의 열 경계 %2개를 정렬했습니다.|%2 limites de colonnes alignées sur %1 lignes.|%2 Spaltengrenzen über %1 Zeilen ausgerichtet.|Alineados %2 límites de columnas en %1 filas.|Alinhados %2 limites de colunas em %1 linhas.
有效适配覆盖率仅 %1%，大部分内容会保持原尺寸并形成空白区域。|Only %1% can adapt; most content keeps its size and may leave empty space.|適応率は %1%です。大半が元サイズを保ち、余白が生じます。|맞춤 가능 비율은 %1%입니다. 대부분 원래 크기를 유지해 빈 공간이 생길 수 있습니다.|Seulement %1% s’adapte ; le reste garde sa taille et peut créer du vide.|Nur %1% anpassbar; übrige Inhalte behalten ihre Größe und erzeugen ggf. Leerraum.|Solo %1% se adapta; el resto conserva tamaño y puede dejar espacio vacío.|Só %1% é adaptável; o restante mantém o tamanho e pode deixar espaço vazio.
检测到新增重叠，已冻结区域 %1 并继续处理其余安全内容。|New overlap detected; region %1 frozen, safe regions continue.|新たな重なりを検出。領域 %1 を固定し、安全な領域を処理します。|새 겹침을 감지하여 영역 %1을 고정하고 안전한 영역만 처리합니다.|Nouveau chevauchement ; zone %1 figée, les autres continuent.|Neue Überlappung erkannt; Bereich %1 einfrieren und sichere fortsetzen.|Nueva superposición; área %1 congelada, continúan las seguras.|Nova sobreposição; área %1 congelada, áreas seguras continuam.
目标宽度低于对象的最小宽度 %1px|Target width is below the minimum %1px|目標幅が最小 %1px 未満|대상 너비가 최솟값 %1px 미만|Largeur inférieure au minimum %1px|Zielbreite unter Minimum %1px|Ancho menor al mínimo %1px|Largura abaixo do mínimo %1px
目标宽度超过对象的最大宽度 %1px|Target width exceeds the maximum %1px|目標幅が最大 %1px 超過|대상 너비가 최댓값 %1px 초과|Largeur supérieure au maximum %1px|Zielbreite über Maximum %1px|Ancho mayor al máximo %1px|Largura acima do máximo %1px
目标高度低于对象的最小高度 %1px|Target height is below the minimum %1px|目標高さが最小 %1px 未満|대상 높이가 최솟값 %1px 미만|Hauteur inférieure au minimum %1px|Zielhöhe unter Minimum %1px|Alto menor al mínimo %1px|Altura abaixo do mínimo %1px
目标高度超过对象的最大高度 %1px|Target height exceeds the maximum %1px|目標高さが最大 %1px 超過|대상 높이가 최댓값 %1px 초과|Hauteur supérieure au maximum %1px|Zielhöhe über Maximum %1px|Alto mayor al máximo %1px|Altura acima do máximo %1px
`;
export const WEIGHT_ROWS=`
极细|Hairline|極細|매우 가늘게|Très fin|Haarfein|Ultrafino|Ultrafino
超细|Extra light|極細|아주 가늘게|Extra léger|Extra leicht|Extrafino|Extraleve
特细|Extra light|極細|아주 가늘게|Extra léger|Extra leicht|Extrafino|Extraleve
特细体|Extra light|極細|아주 가늘게|Extra léger|Extra leicht|Extrafino|Extraleve
纤细|Thin|細字|가늘게|Fin|Dünn|Fino|Fino
纤细体|Thin|細字|가늘게|Fin|Dünn|Fino|Fino
细|Light|細字|얇게|Léger|Leicht|Ligero|Leve
细体|Light|細字|얇게|Léger|Leicht|Ligero|Leve
轻体|Light|細字|얇게|Léger|Leicht|Ligero|Leve
常规|Regular|標準|보통|Normal|Normal|Normal|Normal
常规体|Regular|標準|보통|Normal|Normal|Normal|Normal
普通|Regular|標準|보통|Normal|Normal|Normal|Normal
中等|Medium|中太|중간|Moyen|Mittel|Medio|Médio
中等体|Medium|中太|중간|Moyen|Mittel|Medio|Médio
中黑|Medium|中太|중간|Moyen|Mittel|Medio|Médio
中粗|Semibold|中太|약간 굵게|Demi-gras|Halbfett|Seminegrita|Seminegrito
半粗|Semibold|中太|약간 굵게|Demi-gras|Halbfett|Seminegrita|Seminegrito
半粗体|Semibold|中太|약간 굵게|Demi-gras|Halbfett|Seminegrita|Seminegrito
加粗|Bold|太字|굵게|Gras|Fett|Negrita|Negrito
粗|Bold|太字|굵게|Gras|Fett|Negrita|Negrito
粗体|Bold|太字|굵게|Gras|Fett|Negrita|Negrito
特粗|Extra bold|極太|아주 굵게|Extra gras|Extrafett|Extranegrita|Extranegrito
特粗体|Extra bold|極太|아주 굵게|Extra gras|Extrafett|Extranegrita|Extranegrito
超粗|Extra bold|極太|아주 굵게|Extra gras|Extrafett|Extranegrita|Extranegrito
超粗体|Extra bold|極太|아주 굵게|Extra gras|Extrafett|Extranegrita|Extranegrito
重体|Black|極太|두껍게|Noir|Schwarz|Negra|Preto
黑体字重|Black|極太|두껍게|Noir|Schwarz|Negra|Preto
`;
