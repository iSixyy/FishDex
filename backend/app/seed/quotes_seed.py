"""Más de 100 frases originales de celebración, con humor español "tipo
cuñado", inspiradas estilísticamente en el humor que rodea a la pesca
(juegos de palabras, exageración, orgullo de bar) pero escritas desde cero
para FishDex. Ninguna frase está copiada literalmente de ninguna fuente.
"""
from app.models.quote import QuoteTrigger

GENERIC = [
    "Hoy el pez ha picado... y tú también.",
    "Menudo ejemplar. Eso no es pescar, eso es hacer horas extra.",
    "El pez no sabe quién eres, pero ya te respeta.",
    "Se veía venir. Literalmente estaba bajo el agua.",
    "Hoy has venido fino. El pez, no tanto.",
    "Eso no es una captura, es una declaración de intenciones.",
    "El anzuelo ha hecho más amigos que tú este año.",
    "Has tirado la caña y ha salido el sueldo del mes.",
    "Otro más para la colección. Esto empieza a ser preocupante.",
    "Menudo pez. Ahora cuéntales que lo has sacado tú solo.",
    "Ni el pez se lo esperaba, ni tu cuñado se lo va a creer.",
    "Cada captura es un capítulo. Esta va para el resumen de temporada.",
    "El carrete ha trabajado más que tú en toda la semana.",
    "No ha sido suerte. Bueno, un poco sí, pero no se lo digas a nadie.",
    "El río tenía un pez de menos y tú una excusa de menos para no volver mañana.",
    "Esto hay que enseñarlo antes de que se te olvide exagerar los centímetros.",
    "El sedal ha aguantado más tensión que tú un lunes por la mañana.",
    "Ni en la lonja lo cuentan tan bien como tú lo vas a contar.",
    "Has convertido una tarde aburrida en una hazaña de familia.",
    "El pez picó. Tú, como siempre, ni te enteraste hasta el segundo tirón.",
    "Con esto ya tienes tema de conversación para toda la comida de Navidad.",
    "No hace falta suerte cuando se tiene tanta paciencia mal disimulada.",
    "Esa captura merece marco, no solo una foto en el móvil.",
    "El agua estaba tranquila. Tú, no tanto, al ver que picaba algo.",
    "Un pez menos en el agua, una historia más para el bar.",
]

NEW_SPECIES = [
    "Especie nueva desbloqueada. La FishDex se pone contenta, tú más.",
    "Esto no estaba en tu colección. Ya puedes presumir en el grupo de WhatsApp.",
    "Primera vez que pescas esto. La segunda ya no cuenta tanto, que lo sepas.",
    "Nueva especie, nuevo orgullo, la misma caña de siempre.",
    "Hoy tu FishDex ha crecido más que tu paciencia esperando la picada.",
    "Especie desconocida hasta hoy. Ahora ya no hay quien te calle.",
    "Lo que no habías pescado en años, lo has pescado en una tarde.",
    "Bienvenida a la colección. Aquí dentro se está mejor que en el mar.",
    "Nadie te había presentado a este pez. Ya sois viejos conocidos.",
    "Otra casilla menos en blanco en tu FishDex particular.",
    "Especie inédita. Vas a tener que inventarte una anécdota nueva.",
    "Hasta hoy solo la habías visto en fotos de otros. Ahora es tuya.",
    "Tu colección se actualiza. Tu ego, también.",
    "Lo raro no es pescarla, es que encima la hayas reconocido bien.",
    "Especie nueva en el álbum. Falta el cromo repetido para cambiar.",
    "Hoy has ampliado fronteras. Las de tu FishDex, al menos.",
    "Una especie más marcada. Un pescador más insoportable.",
    "El misterio ya no es tal: hoy la has cazado y catalogado.",
    "Se estrena ficha nueva. Se estrena excusa nueva para volver al agua.",
    "Lo que otros buscan durante años, tú lo encontraste en una tarde cualquiera.",
    "Especie desbloqueada. Guarda la captura de pantalla para el futuro.",
    "Cada especie nueva es un trofeo silencioso que solo tú vas a contar cien veces.",
    "El mapa de tu FishDex tiene una región más conquistada.",
    "Nunca la habías visto de cerca. Ahora la tienes en la mano y en la ficha.",
    "Hoy tu colección ha subido de nivel sin pedirte permiso.",
]

PERSONAL_RECORD = [
    "Nuevo récord personal. Tu antiguo yo, oficialmente superado.",
    "La marca anterior ya es historia. Esta la vas a enmarcar.",
    "Esto no es una captura, es un titular: 'Se bate récord en aguas españolas'.",
    "Tu mejor pez hasta hoy... hasta hoy.",
    "El listón ha subido. Tú, más todavía.",
    "Nueva plusmarca personal. La báscula no miente, aunque tú sí un poco al contarlo.",
    "Esto hay que celebrarlo por todo lo alto, o al menos con una cerveza fresquita.",
    "Récord roto. El anterior ya puede irse a jubilarse tranquilo.",
    "El pez más grande que has sacado nunca. Y eso que dijiste que el anterior no se podía superar.",
    "Marca personal pulverizada. Ya puedes mirar por encima del hombro a tu yo del año pasado.",
    "Esto entra directo al salón de la fama de tu FishDex.",
    "Tu récord anterior te manda un mensaje: 'Bien jugado'.",
    "Hoy no has pescado un pez, has pescado tu mejor versión.",
    "Nueva cima personal. La próxima vez tocará escalar más alto todavía.",
    "El anterior récord ya puede colgar la caña.",
    "Esto sí que es superarse a uno mismo, y no lo que dices en las resoluciones de enero.",
    "Marca histórica en tu FishDex. Bueno, histórica desde la semana pasada.",
    "El pez más grande de tu vida... por ahora.",
    "Tu récord personal tiembla, y con razón.",
    "Esto merece foto, marco y una mención especial en la cena familiar.",
]

# (texto, peso_mínimo_kg)
HEAVY_CATCH = [
    ("Menudo peso. Eso no se pesca, eso se levanta con permiso del fisioterapeuta.", 2.0),
    ("Con ese peso, casi necesitas una carretilla en vez de una nevera.", 2.0),
    ("Buen peso el de hoy. La nevera ya está pensando dónde meterlo.", 1.5),
    ("Eso pesa lo suficiente como para presumir sin exagerar, por una vez.", 1.5),
    ("Eso no es un pez, es una hipoteca a plazos con escamas.", 3.0),
    ("La báscula ha hecho ruido de sorpresa, como tú al verlo salir del agua.", 3.0),
    ("Con ese peso ya puedes dejar de decir 'el que se escapó era más grande'.", 2.5),
    ("Ese peso convierte cualquier charla de bar en una charla de leyenda.", 4.0),
    ("Con esos kilos no hace falta inflar la historia, ya impresiona sola.", 4.0),
    ("Con ese peso, el pez debería pagar el peaje de la báscula.", 5.0),
    ("Eso pesa más que tus excusas para no ir a pescar entre semana.", 5.0),
    ("Menudo animal. Eso no se sube a la barca, se homenajea.", 5.0),
    ("Ese ejemplar tiene más kilos que tu maleta de vacaciones... y menos gastos de facturación.", 7.0),
    ("Con ese peso podrías haber facturado equipaje extra en el aeropuerto.", 7.0),
    ("Eso no es una captura, es un acontecimiento familiar con báscula de por medio.", 10.0),
    ("El pez pesa tanto que hasta el carrete ha pedido un aumento de sueldo.", 10.0),
    ("Con ese peso, más que pescador pareces mudanzas urgentes.", 15.0),
    ("Ese pez no ha picado, se ha entregado por respeto a tu brazo.", 15.0),
    ("Semejante mole no se pesca, se homenajea con orquesta.", 20.0),
    ("Con ese peso, hasta la báscula ha pedido una pausa para recuperarse.", 20.0),
]

RARE_PLUS = [
    "Rareza confirmada: este pez no se cruza todos los días con cualquiera.",
    "Esto no lo pesca cualquiera. Bueno, tú tampoco eres cualquiera, pero ya me entiendes.",
    "Pieza especial en el agua, pieza especial en tu FishDex.",
    "No todos los días se cruza uno con algo así. Aprovecha para presumir en condiciones.",
    "Esta captura tiene un brillo especial. Literal y en la app.",
    "De las que se cuentan durante años, y encima esta vez es verdad.",
    "Rareza alta, paciencia más alta todavía. Bien merecido.",
    "Esto no es suerte de principiante, esto es puntería de veterano.",
    "Pocos pueden decir que se han cruzado con esta especie. Tú, desde hoy, sí.",
    "Captura de las que hacen que merezca la pena madrugar un sábado.",
    "Esto sube el nivel de la conversación en cualquier grupo de pesca.",
    "No es una captura cualquiera, es casi un acontecimiento regional.",
    "Rareza confirmada. Guarda la foto, que esta la vas a necesitar.",
    "Esta especie no aparece por compromiso, aparece por mérito.",
    "Lo raro de verdad no se pesca, se celebra. Y esto se celebra.",
    "Con esta captura, hasta los peces normales te van a mirar con respeto.",
    "Esto no entra en la categoría de 'un pez más'. Esto entra en la de anécdota eterna.",
    "Pieza excepcional. La FishDex se pone en modo fiesta.",
    "No hacía falta ser tan bueno, pero ya que estabas...",
    "Esta captura no se explica, se enmarca.",
]


def build_quotes_seed() -> list[dict]:
    quotes = []
    quotes += [dict(text=t, trigger=QuoteTrigger.GENERIC, min_weight_kg=None) for t in GENERIC]
    quotes += [dict(text=t, trigger=QuoteTrigger.NEW_SPECIES, min_weight_kg=None) for t in NEW_SPECIES]
    quotes += [dict(text=t, trigger=QuoteTrigger.PERSONAL_RECORD, min_weight_kg=None) for t in PERSONAL_RECORD]
    quotes += [dict(text=t, trigger=QuoteTrigger.HEAVY_CATCH, min_weight_kg=w) for t, w in HEAVY_CATCH]
    quotes += [dict(text=t, trigger=QuoteTrigger.RARE_PLUS, min_weight_kg=None) for t in RARE_PLUS]
    return quotes


QUOTES_SEED = build_quotes_seed()
