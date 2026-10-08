// Limit this preference to water-name labels; coastlines and other place names stay intact.
const nameFields = ['name_en', 'name:en', 'name', 'name:latin', 'name:nonlatin']
export const WATER_LABEL_FILTER = ['!', ['any', ...nameFields.map(field =>
  ['in', 'sea of japan', ['downcase', ['coalesce', ['get', field], '']]],
)]]

export function applyBasemapLabels(map) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol' || layer['source-layer'] !== 'water_name') continue
    map.setFilter(layer.id, layer.filter ? ['all', layer.filter, WATER_LABEL_FILTER] : WATER_LABEL_FILTER)
  }
}
