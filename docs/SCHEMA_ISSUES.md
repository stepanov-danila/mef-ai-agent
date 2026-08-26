# Известные дефекты MEF config schema

Найдено при тестировании бэкенда против реальной схемы `mef-config.json`
(Draft-04, ~4700 строк). Ни один из пунктов ниже не исправляется в коде
бэкенда — валидатор их **толерантно обходит** (`strict: false` в Ajv), а
здесь они задокументированы для владельцев схемы.

Схема сама по себе не хранится в этом репозитории (см.
`openspec/changes/archive/*/proposal.md` для `fix-union-validation`):
репозиторий публичный, схема содержит внутренние детали инфраструктуры.
Ссылки ниже — на путь внутри схемы (JSON pointer через `definitions`),
не на номера строк конкретного файла.

## 1. `definitions.mlsConfig.properties.s3Client` — поле вне `properties`

```json
"s3Client": {
  "socketTimeout": {
    "type": "integer",
    "minimum": 1
  }
}
```

`socketTimeout` лежит прямо под `s3Client`, а не под
`s3Client.properties.socketTimeout`. В результате `socketTimeout`
интерпретируется JSON Schema как неизвестное ключевое слово, узел
`s3Client` фактически не имеет описанных свойств и принимает **любое**
значение без проверки.

**Как это выглядит правильно** — 20 строк ниже в той же схеме, у
`cephConfig.properties.s3`:

```json
"s3": {
  "type": "object",
  "additionalProperties": false,
  "required": ["endpoint", "authSecret", "ssl"],
  "properties": {
    ...
    "socketTimeout": { "type": "integer", "minimum": 1 }
  }
}
```

**Исправление**: обернуть `socketTimeout` в `properties`, добавить
`type: "object"` и `additionalProperties: false` по аналогии с `cephConfig.s3`.

## 2. `definitions.profiler` — `type: "object"` вместе с `items`

```json
"profiler": {
  "type": "object",
  "items": {
    "type": "object",
    "required": [ "settings", "jenkinsCaBundleSecret", ... ],
    ...
  }
}
```

`items` — ключевое слово для `type: "array"`, для `type: "object"` оно
игнорируется. Узел не описывает `properties` напрямую, поэтому ~55 строк
ограничений под `items` мертвы, и `profiler` принимает произвольный объект.

**Исправление**: либо сменить `type` на `"array"` (если `profiler`
действительно должен быть массивом — сравните с `definitions.database` и
`definitions.kafkaTopicsConfig`, где `type: "array"` + `items` оформлены
верно), либо перенести содержимое `items` в `properties`, если
предполагался единственный объект.

## 3. `definitions.resources` — `patternProperties` вместо `properties`

```json
"resources": {
  "type": "object",
  "required": ["limits", "requests"],
  "patternProperties": {
    "limits":   { "$ref": "#/definitions/resourcesEntry" },
    "requests": { "$ref": "#/definitions/resourcesEntry" }
  },
  "additionalProperties": false
}
```

`"limits"` и `"requests"` — регулярные выражения без якорей (`^…$`), а не
литеральные имена свойств. Любой ключ, лишь *содержащий* подстроку
`limits` или `requests` (например `mylimitsX`, `requests2`), тоже
проходит `patternProperties` и поэтому не блокируется
`additionalProperties: false`. Это определение используется как `$ref`
27 раз — самое частое переиспользуемое определение в схеме.

**Исправление**: заменить `patternProperties` на `properties` с теми же
двумя литеральными ключами.
