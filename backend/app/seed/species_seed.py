"""Semilla de especies para España.

Los datos biológicos (peso, longitud, hábitat) son aproximaciones generales
con fines de MVP. Los datos LEGALES (talla mínima, vedas) se definen aparte
en `regulations_seed.py` y solo se incluyen cuando hay certeza razonable de
la fuente oficial; el resto se deja sin regular a propósito, mostrando
"Información no disponible" en la app en lugar de inventar cifras.
"""
from app.core.game_config import Rarity
from app.models.fish_species import WaterType

SPECIES_SEED = [
    dict(
        dex_number=1, name="Lubina", scientific_name="Dicentrarchus labrax",
        description="Depredador costero muy apreciado tanto por pescadores de orilla como de embarcación. "
                     "Habita rías, estuarios y rompientes de todo el litoral español.",
        fun_fact="La lubina puede vivir más de 15 años y cambia de dieta según crece: de crustáceos a otros peces.",
        min_weight_kg=0.5, max_weight_kg=7.0, approx_min_length_cm=30, approx_max_length_cm=100,
        rarity=Rarity.UNCOMMON, habitat="Rías, estuarios y rompientes rocosos", water_type=WaterType.SALT,
        region="Cantábrico, Atlántico gallego, Mediterráneo",
    ),
    dict(
        dex_number=2, name="Dorada", scientific_name="Sparus aurata",
        description="Reconocible por la franja dorada entre los ojos. Frecuenta fondos arenosos y praderas "
                     "de posidonia, muy popular en la pesca desde playa y roca.",
        fun_fact="Es hermafrodita protándrica: nace macho y muchas cambian a hembra con la edad.",
        min_weight_kg=0.3, max_weight_kg=6.0, approx_min_length_cm=20, approx_max_length_cm=70,
        rarity=Rarity.RARE, habitat="Fondos arenosos y praderas marinas", water_type=WaterType.SALT,
        region="Mediterráneo, Golfo de Cádiz, rías atlánticas",
    ),
    dict(
        dex_number=3, name="Sargo", scientific_name="Diplodus sargus",
        description="Pez de roca muy desconfiado y difícil de engañar, habitual en pesca a fondo y con anzuelo fino.",
        fun_fact="Su vista y olfato son extremadamente finos, lo que lo convierte en uno de los peces más listos de roca.",
        min_weight_kg=0.2, max_weight_kg=3.5, approx_min_length_cm=15, approx_max_length_cm=45,
        rarity=Rarity.RARE, habitat="Fondos rocosos y puertos", water_type=WaterType.SALT,
        region="Mediterráneo, Cantábrico, Atlántico",
    ),
    dict(
        dex_number=4, name="Jurel", scientific_name="Trachurus trachurus",
        description="Pez pelágico gregario que se mueve en bancos numerosos, muy común en pesca de costa y barco.",
        fun_fact="Tiene una línea de escamas óseas (escudetes) a lo largo del costado que lo protege como una armadura.",
        min_weight_kg=0.1, max_weight_kg=1.5, approx_min_length_cm=15, approx_max_length_cm=45,
        rarity=Rarity.COMMON, habitat="Aguas costeras y de altura", water_type=WaterType.SALT,
        region="Cantábrico, Atlántico, Mediterráneo",
    ),
    dict(
        dex_number=5, name="Caballa", scientific_name="Scomber scombrus",
        description="Pelágico rápido y voraz, protagonista de jornadas de pesca en bandos junto a la costa.",
        fun_fact="Nada casi sin parar: si se detiene demasiado tiempo, no puede oxigenar bien sus branquias.",
        min_weight_kg=0.15, max_weight_kg=1.2, approx_min_length_cm=20, approx_max_length_cm=40,
        rarity=Rarity.COMMON, habitat="Aguas abiertas costeras", water_type=WaterType.SALT,
        region="Cantábrico, Atlántico norte",
    ),
    dict(
        dex_number=6, name="Merluza", scientific_name="Merluccius merluccius",
        description="Uno de los pescados más consumidos en España, habitual en pesca de altura y desde embarcación.",
        fun_fact="Es un depredador nocturno: caza sobre todo al anochecer y de madrugada.",
        min_weight_kg=0.5, max_weight_kg=8.0, approx_min_length_cm=30, approx_max_length_cm=100,
        rarity=Rarity.UNCOMMON, habitat="Plataforma y talud continental", water_type=WaterType.SALT,
        region="Cantábrico, Atlántico, Mediterráneo",
    ),
    dict(
        dex_number=7, name="Rodaballo", scientific_name="Scophthalmus maximus",
        description="Pez plano de fondos arenosos, muy codiciado tanto en gastronomía como en pesca deportiva.",
        fun_fact="Nace con los ojos a cada lado de la cabeza como cualquier pez, y uno migra al otro lado al crecer.",
        min_weight_kg=1.0, max_weight_kg=10.0, approx_min_length_cm=30, approx_max_length_cm=90,
        rarity=Rarity.EPIC, habitat="Fondos arenosos costeros", water_type=WaterType.SALT,
        region="Cantábrico, Atlántico gallego",
    ),
    dict(
        dex_number=8, name="Corvina", scientific_name="Argyrosomus regius",
        description="Gigante de las rías, capaz de alcanzar tamaños espectaculares. Muy buscada en pesca de altura desde costa.",
        fun_fact="Puede emitir sonidos audibles bajo el agua vibrando músculos junto a la vejiga natatoria.",
        min_weight_kg=2.0, max_weight_kg=40.0, approx_min_length_cm=50, approx_max_length_cm=180,
        rarity=Rarity.EPIC, habitat="Rías y estuarios profundos", water_type=WaterType.SALT,
        region="Rías gallegas, Golfo de Cádiz",
    ),
    dict(
        dex_number=9, name="Congrio", scientific_name="Conger conger",
        description="Anguiliforme marino de gran tamaño y fuerza, habitual en pesca de fondo nocturna en zonas rocosas.",
        fun_fact="Puede superar los 2 metros de longitud y su mordisco es tan temido como su fuerza al recogerlo.",
        min_weight_kg=1.0, max_weight_kg=30.0, approx_min_length_cm=60, approx_max_length_cm=200,
        rarity=Rarity.RARE, habitat="Cuevas y fondos rocosos profundos", water_type=WaterType.SALT,
        region="Cantábrico, Atlántico, Mediterráneo",
    ),
    dict(
        dex_number=10, name="Trucha común", scientific_name="Salmo trutta",
        description="Emblema de la pesca fluvial española, presente en ríos de montaña de aguas frías y limpias.",
        fun_fact="Su patrón de manchas es único en cada individuo, como una huella dactilar.",
        min_weight_kg=0.1, max_weight_kg=3.0, approx_min_length_cm=15, approx_max_length_cm=60,
        rarity=Rarity.UNCOMMON, habitat="Ríos y arroyos de montaña", water_type=WaterType.FRESH,
        region="Pirineos, Sistema Central, cordillera Cantábrica",
    ),
    dict(
        dex_number=11, name="Trucha arcoíris", scientific_name="Oncorhynchus mykiss",
        description="Especie introducida muy habitual en embalses y cotos gestionados para la pesca deportiva.",
        fun_fact="Es originaria de Norteamérica y debe su nombre a la banda iridiscente que recorre su costado.",
        min_weight_kg=0.15, max_weight_kg=4.0, approx_min_length_cm=18, approx_max_length_cm=65,
        rarity=Rarity.COMMON, habitat="Embalses y cotos de pesca gestionados", water_type=WaterType.FRESH,
        region="Toda España en cotos y embalses repoblados",
    ),
    dict(
        dex_number=12, name="Lucio", scientific_name="Esox lucius",
        description="Depredador de emboscada en aguas quietas, con una mandíbula repleta de dientes afilados.",
        fun_fact="Puede permanecer completamente inmóvil durante minutos esperando a su presa antes de atacar.",
        min_weight_kg=0.5, max_weight_kg=15.0, approx_min_length_cm=30, approx_max_length_cm=120,
        rarity=Rarity.RARE, habitat="Embalses y ríos de curso lento", water_type=WaterType.FRESH,
        region="Cuencas del Ebro, Tajo y Guadiana",
    ),
    dict(
        dex_number=13, name="Carpa", scientific_name="Cyprinus carpio",
        description="Una de las especies más pescadas en embalses españoles, muy resistente y de gran longevidad.",
        fun_fact="Puede vivir más de 30 años y algunos ejemplares superan fácilmente los 20 kg.",
        min_weight_kg=0.5, max_weight_kg=25.0, approx_min_length_cm=25, approx_max_length_cm=100,
        rarity=Rarity.COMMON, habitat="Embalses, pantanos y ríos de curso lento", water_type=WaterType.FRESH,
        region="Toda la España peninsular",
    ),
    dict(
        dex_number=14, name="Black bass", scientific_name="Micropterus salmoides",
        description="Especie introducida muy popular en pesca deportiva por su combatividad al ser capturada.",
        fun_fact="Es capaz de saltar fuera del agua para intentar soltarse del anzuelo una vez enganchado.",
        min_weight_kg=0.3, max_weight_kg=5.0, approx_min_length_cm=20, approx_max_length_cm=60,
        rarity=Rarity.UNCOMMON, habitat="Embalses de aguas templadas", water_type=WaterType.FRESH,
        region="Cuencas del Guadiana, Guadalquivir y Ebro",
    ),
    dict(
        dex_number=15, name="Barbo", scientific_name="Luciobarbus bocagei",
        description="Ciprínido autóctono de ríos españoles, con barbillas sensoriales características junto a la boca.",
        fun_fact="Usa sus barbillas para detectar comida enterrada en el fondo del río, casi sin necesitar la vista.",
        min_weight_kg=0.2, max_weight_kg=6.0, approx_min_length_cm=20, approx_max_length_cm=80,
        rarity=Rarity.COMMON, habitat="Ríos de corriente moderada", water_type=WaterType.FRESH,
        region="Cuencas del Duero, Tajo y Guadiana",
    ),
    dict(
        dex_number=16, name="Siluro", scientific_name="Silurus glanis",
        description="El gigante de agua dulce de los ríos españoles, especie introducida que puede alcanzar tamaños descomunales.",
        fun_fact="Es uno de los peces de agua dulce más grandes de Europa y puede superar los 2 metros de longitud.",
        min_weight_kg=2.0, max_weight_kg=80.0, approx_min_length_cm=60, approx_max_length_cm=250,
        rarity=Rarity.LEGENDARY, habitat="Embalses y tramos profundos del Ebro", water_type=WaterType.FRESH,
        region="Cuenca del Ebro (Mequinenza, Ribarroja)",
    ),
    dict(
        dex_number=17, name="Anguila", scientific_name="Anguilla anguilla",
        description="Especie catadrómica de biología fascinante y en fuerte declive, sujeta a fuertes restricciones "
                     "de pesca en toda Europa por su estado de conservación.",
        fun_fact="Nace en el mar de los Sargazos y recorre miles de kilómetros para vivir en ríos europeos antes de "
                  "regresar a reproducirse allí donde nació.",
        min_weight_kg=0.1, max_weight_kg=4.0, approx_min_length_cm=30, approx_max_length_cm=130,
        rarity=Rarity.MYTHIC, habitat="Ríos, estuarios y marismas", water_type=WaterType.BRACKISH,
        region="Marismas del Guadalquivir, rías gallegas, Delta del Ebro",
    ),
]
