# Claudemods

Mods para Claude Code.

## model-router

Antes de cada prompt, Haiku clasifica la tarea como simple, moderada o compleja y el turno se ejecuta en el modelo que corresponde:

| Tarea | Modelo | Coste |
| --- | --- | --- |
| simple (preguntas rápidas, cambios de una línea) | Haiku | $ |
| moderada (una funcionalidad, un bug en pocos archivos) | Sonnet | $$ |
| compleja (arquitectura, refactor grande, bug difícil) | Opus | $$$ |

Encima del prompt aparece una banda con el modelo elegido resaltado y el motivo, y botones para pasar a modo **Auto** o fijar un modelo a mano. También se puede usar `/router auto|haiku|sonnet|opus`. Los subagentes conservan su propio modelo.

La banda sobre el prompt solo existe en la terminal y en la app de escritorio. En la app móvil y en la web la misma vista se abre en un panel **Model router**; `/router` sin argumentos lo abre en cualquier superficie.

### Instalar

En la app de escritorio: **+** junto al prompt → **Plugins** → **Add marketplace** con `ilopmuo/Claudemods` → **Add plugin** → `model-router`.

En la terminal:

```
/plugin marketplace add ilopmuo/Claudemods
/plugin install model-router@claudemods
```

### Notas

- Cambiar de modelo entre turnos invalida la caché del prompt del modelo anterior, así que en conversaciones largas alternar mucho puede costar más de lo que ahorra. Si eso pasa, fija un modelo con `/router`.
- La clasificación es una llamada corta a Haiku antes de cada prompt; si falla, se estima por longitud y palabras clave.

### Desarrollo

```
claude plugin validate mods/model-router
claude plugin test mods/model-router
```
