-- =====================================================================
-- ARCHIVO: 01_tablas.sql
-- Crea las tablas de la base de datos de la aplicación de pedidos
-- (modelo multicentro: sociedades, centros y habilitaciones).
-- Se ejecuta UNA vez en el "SQL Editor" de Supabase (o con psql).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Borramos las tablas si ya existían, para poder ejecutar el script
-- varias veces mientras desarrollamos. Se borran en orden inverso a
-- como se crean (primero las hijas y luego las padres) para que las
-- claves foráneas no den error.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS plantillas_exportacion;
DROP TABLE IF EXISTS plantillas_importacion;
DROP TABLE IF EXISTS exportaciones_xml;
DROP TABLE IF EXISTS pedido_pdf;
DROP TABLE IF EXISTS configuracion;
DROP TABLE IF EXISTS lineas_compra;
DROP TABLE IF EXISTS compra;
DROP TABLE IF EXISTS contadores_pedido;
DROP TABLE IF EXISTS lineas_solicitud;
DROP TABLE IF EXISTS solicitud_pedido;
DROP TABLE IF EXISTS centro_articulos;
DROP TABLE IF EXISTS centro_proveedores;
DROP TABLE IF EXISTS usuario_centros;
DROP TABLE IF EXISTS centro_emails_cc;
DROP TABLE IF EXISTS centros;
DROP TABLE IF EXISTS sociedades;
DROP TABLE IF EXISTS articulos_tarificados;
DROP TABLE IF EXISTS articulos;
DROP TABLE IF EXISTS proveedores;
DROP TABLE IF EXISTS usuarios;


-- ---------------------------------------------------------------------
-- 1. USUARIOS
-- Guarda las cuentas. Al registrarse, la cuenta queda inactiva
-- (activo_usuario = FALSE) y sin rol (rol = NULL) hasta que un
-- administrador la active.
-- El CHECK del rol solo deja escribir 'ADMIN' o 'USUARIO' (o dejarlo NULL).
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id_usuario       SERIAL PRIMARY KEY,
    nombre_usuario   VARCHAR(50)  NOT NULL UNIQUE,
    nombre_completo  VARCHAR(100) NOT NULL,
    rol              VARCHAR(10)  NULL CHECK (rol IN ('ADMIN', 'USUARIO')),
    email_usuario    VARCHAR(120) NOT NULL UNIQUE,
    contrasena       VARCHAR(255) NOT NULL,
    activo_usuario   BOOLEAN      NOT NULL DEFAULT FALSE
);


-- ---------------------------------------------------------------------
-- 2. PROVEEDORES
-- Empresas a las que se compra. El CIF no se puede repetir.
-- activo_proveedor permite "desactivar" sin borrar (baja lógica).
-- ---------------------------------------------------------------------
CREATE TABLE proveedores (
    id_proveedor      SERIAL PRIMARY KEY,
    codigo_erp        INTEGER      NOT NULL UNIQUE,
    nombre_proveedor  VARCHAR(100) NOT NULL,
    razon_social      VARCHAR(150) NOT NULL,
    cif               VARCHAR(15)  NOT NULL UNIQUE,
    direccion         VARCHAR(150),
    cod_postal        VARCHAR(10),
    provincia         VARCHAR(50),
    localidad         VARCHAR(80),
    telefono          VARCHAR(20),
    email_proveedor   VARCHAR(120) NOT NULL,
    activo_proveedor  BOOLEAN      NOT NULL DEFAULT TRUE
);


-- ---------------------------------------------------------------------
-- 3. ARTICULOS (catálogo maestro)
-- Catálogo global de artículos. No tiene precios. Cada centro solo
-- ve los artículos que el administrador le habilite (centro_articulos).
-- El EAN es opcional pero, si se pone, no se puede repetir.
-- El IVA tiene que ser 0 o mayor.
-- ---------------------------------------------------------------------
CREATE TABLE articulos (
    id_articulo           SERIAL PRIMARY KEY,
    codigo_erp            INTEGER      NOT NULL UNIQUE,
    ean                   VARCHAR(20) UNIQUE,
    descripcion_articulo  VARCHAR(150) NOT NULL,
    iva                   NUMERIC(4,2) NOT NULL CHECK (iva >= 0),
    activo_articulo       BOOLEAN      NOT NULL DEFAULT TRUE
);


-- ---------------------------------------------------------------------
-- 4. ARTICULOS_TARIFICADOS
-- Es "el artículo X tal y como lo vende el proveedor Y, a este precio".
-- Las tarifas son GLOBALES: valen igual para todos los centros.
-- Las dos claves foráneas enlazan con articulos y proveedores.
-- Los dos UNIQUE del final garantizan que:
--   * un artículo solo una tarifa por proveedor
--   * un proveedor no repite el mismo código de referencia
-- ---------------------------------------------------------------------
CREATE TABLE articulos_tarificados (
    id_articulo_tarificado      SERIAL PRIMARY KEY,
    id_articulo                 INTEGER NOT NULL REFERENCES articulos (id_articulo),
    id_proveedor                INTEGER NOT NULL REFERENCES proveedores (id_proveedor),
    descripcion_proveedor       VARCHAR(150),
    referencia_proveedor        VARCHAR(50)    NOT NULL,
    precio                      NUMERIC(10,4)  NOT NULL CHECK (precio >= 0),
    descuento                   NUMERIC(5,2)   NOT NULL DEFAULT 0 CHECK (descuento >= 0 AND descuento <= 100),
    activo_articulo_tarificado  BOOLEAN        NOT NULL DEFAULT TRUE,
    UNIQUE (id_articulo, id_proveedor),
    UNIQUE (id_proveedor, referencia_proveedor)
);


-- ---------------------------------------------------------------------
-- 5. SOCIEDADES (razones sociales)
-- Datos fiscales. Una sociedad tiene uno o varios centros.
-- ---------------------------------------------------------------------
CREATE TABLE sociedades (
    id_sociedad       SERIAL PRIMARY KEY,
    razon_social      VARCHAR(150) NOT NULL,
    cif               VARCHAR(15)  NOT NULL UNIQUE,
    dir_fiscal        VARCHAR(150) NOT NULL,
    cp_fiscal         VARCHAR(10)  NOT NULL,
    localidad_fiscal  VARCHAR(80)  NOT NULL,
    provincia_fiscal  VARCHAR(50)  NOT NULL,
    activo_sociedad   BOOLEAN      NOT NULL DEFAULT TRUE
);


-- ---------------------------------------------------------------------
-- 6. CENTROS
-- Cada hotel/economato que hace pedidos.
--   numero_serie   -> identificador del centro en el ERP (ej. 3A).
--                     Único y editable: por eso la clave es id_centro.
--   numero_almacen -> identificador del almacén en el ERP.
--   (En el ERP la serie admite 8 caracteres y el almacén 3.)
--   observaciones_pedido -> texto propio del centro para el pie del PDF.
--   email_envio    -> desde esta cuenta se envían los pedidos del centro.
--   smtp_*         -> datos para enviar el correo desde esa cuenta.
--                     La contraseña se guarda CIFRADA por el backend.
-- ---------------------------------------------------------------------
CREATE TABLE centros (
    id_centro              SERIAL PRIMARY KEY,
    id_sociedad            INTEGER      NOT NULL REFERENCES sociedades (id_sociedad),
    numero_serie           VARCHAR(8)   NOT NULL UNIQUE,
    numero_almacen         VARCHAR(3)   NOT NULL UNIQUE,
    nombre_centro          VARCHAR(100) NOT NULL,
    telefono_1             VARCHAR(20)  NOT NULL,
    telefono_2             VARCHAR(20),
    responsable            VARCHAR(100),
    dir_entrega            VARCHAR(150) NOT NULL,
    cp_entrega             VARCHAR(10)  NOT NULL,
    localidad_entrega      VARCHAR(80)  NOT NULL,
    provincia_entrega      VARCHAR(50)  NOT NULL,
    observaciones_entrega  VARCHAR(500),
    observaciones_pedido   VARCHAR(1000),
    email_envio            VARCHAR(120) NOT NULL,
    smtp_host              VARCHAR(120),
    smtp_puerto            INTEGER CHECK (smtp_puerto BETWEEN 1 AND 65535),
    smtp_usuario           VARCHAR(120),
    smtp_contrasena        VARCHAR(500),
    activo_centro          BOOLEAN      NOT NULL DEFAULT TRUE
);


-- ---------------------------------------------------------------------
-- 7. CENTRO_EMAILS_CC
-- Correos que van en copia en los pedidos de cada centro.
-- ---------------------------------------------------------------------
CREATE TABLE centro_emails_cc (
    id_centro  INTEGER      NOT NULL REFERENCES centros (id_centro) ON DELETE CASCADE,
    email      VARCHAR(120) NOT NULL,
    PRIMARY KEY (id_centro, email)
);


-- ---------------------------------------------------------------------
-- 8. USUARIO_CENTROS
-- Centros para los que puede pedir cada USUARIO. Los ADMIN no
-- necesitan filas aquí: tienen acceso a todos los centros.
-- ---------------------------------------------------------------------
CREATE TABLE usuario_centros (
    id_usuario  INTEGER NOT NULL REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
    id_centro   INTEGER NOT NULL REFERENCES centros (id_centro) ON DELETE CASCADE,
    PRIMARY KEY (id_usuario, id_centro)
);


-- ---------------------------------------------------------------------
-- 9. CENTRO_PROVEEDORES / 10. CENTRO_ARTICULOS
-- Lo que el administrador habilita en cada centro: a qué proveedores
-- puede pedir y qué artículos forman su catálogo.
-- ---------------------------------------------------------------------
CREATE TABLE centro_proveedores (
    id_centro     INTEGER NOT NULL REFERENCES centros (id_centro) ON DELETE CASCADE,
    id_proveedor  INTEGER NOT NULL REFERENCES proveedores (id_proveedor) ON DELETE CASCADE,
    PRIMARY KEY (id_centro, id_proveedor)
);

CREATE TABLE centro_articulos (
    id_centro    INTEGER NOT NULL REFERENCES centros (id_centro) ON DELETE CASCADE,
    id_articulo  INTEGER NOT NULL REFERENCES articulos (id_articulo) ON DELETE CASCADE,
    PRIMARY KEY (id_centro, id_articulo)
);


-- ---------------------------------------------------------------------
-- 11. SOLICITUD_PEDIDO
-- Cabecera de la solicitud que hace el personal.
-- La fecha se pone sola con la fecha y hora actual (DEFAULT NOW()).
-- El estado solo puede ser PENDIENTE o PROCESADO.
-- Cada solicitud es para un centro concreto.
-- ---------------------------------------------------------------------
CREATE TABLE solicitud_pedido (
    id_solicitud     SERIAL PRIMARY KEY,
    id_usuario       INTEGER     NOT NULL REFERENCES usuarios (id_usuario),
    id_centro        INTEGER     NOT NULL REFERENCES centros (id_centro),
    fecha_solicitud  TIMESTAMP   NOT NULL DEFAULT NOW(),
    estado           VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PROCESADO'))
);


-- ---------------------------------------------------------------------
-- 12. LINEAS_SOLICITUD
-- Cada artículo que se pide dentro de una solicitud.
-- ON DELETE CASCADE: si se borra la solicitud se borran sus líneas.
-- La cantidad tiene que ser mayor que 0.
-- ---------------------------------------------------------------------
CREATE TABLE lineas_solicitud (
    id_linea_solicitud  SERIAL PRIMARY KEY,
    id_solicitud        INTEGER       NOT NULL REFERENCES solicitud_pedido (id_solicitud) ON DELETE CASCADE,
    id_articulo         INTEGER       NOT NULL REFERENCES articulos (id_articulo),
    cantidad            NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
    observaciones       VARCHAR(255)
);


-- ---------------------------------------------------------------------
-- 13. CONTADORES_PEDIDO
-- Último número de pedido usado por cada centro y año. El motor lo
-- incrementa con un único UPDATE atómico, así dos pedidos simultáneos
-- nunca reciben el mismo número.
-- ---------------------------------------------------------------------
CREATE TABLE contadores_pedido (
    id_centro      INTEGER NOT NULL REFERENCES centros (id_centro) ON DELETE CASCADE,
    anio           INTEGER NOT NULL,
    ultimo_numero  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id_centro, anio)
);


-- ---------------------------------------------------------------------
-- 14. COMPRA (pedido a un proveedor)
-- La crea el motor de adjudicación: una por cada proveedor.
-- Estado PENDIENTE hasta que el usuario lo marca TRAMITADO.
-- Identificación para el ERP: serie_pedido + numero_pedido.
--   numero_pedido -> entero AAAANNNNN (año + contador del centro),
--                    ej. 202600001. Se reinicia cada año.
--   serie_pedido  -> copia de la serie del centro al crear el pedido,
--                    para que no cambie si luego se edita el centro.
-- ---------------------------------------------------------------------
CREATE TABLE compra (
    id_compra       SERIAL PRIMARY KEY,
    id_centro       INTEGER     NOT NULL REFERENCES centros (id_centro),
    id_solicitud    INTEGER     REFERENCES solicitud_pedido (id_solicitud) ON DELETE SET NULL,
    id_proveedor    INTEGER     NOT NULL REFERENCES proveedores (id_proveedor),
    serie_pedido    VARCHAR(8)  NOT NULL,
    numero_pedido   INTEGER     NOT NULL,
    fecha_creacion  TIMESTAMP   NOT NULL DEFAULT NOW(),
    estado          VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'TRAMITADO')),
    fecha_entrega   DATE        NOT NULL,
    fecha_envio     TIMESTAMP,
    UNIQUE (id_centro, numero_pedido)
);


-- ---------------------------------------------------------------------
-- 15. LINEAS_COMPRA (entidad débil)
-- Su clave primaria es doble: (id_compra, id_linea_compra).
-- precio_tarifa, descuento y precio_coste (neto) se guardan "congelados"
-- al crear el pedido; si luego cambia la tarifa, estos valores no cambian.
-- ---------------------------------------------------------------------
CREATE TABLE lineas_compra (
    id_compra               INTEGER       NOT NULL REFERENCES compra (id_compra) ON DELETE CASCADE,
    id_linea_compra         INTEGER       NOT NULL,
    id_articulo_tarificado  INTEGER       NOT NULL REFERENCES articulos_tarificados (id_articulo_tarificado),
    cantidad_compra         NUMERIC(10,2) NOT NULL CHECK (cantidad_compra > 0),
    precio_tarifa           NUMERIC(10,4) NOT NULL CHECK (precio_tarifa >= 0),
    descuento               NUMERIC(5,2)  NOT NULL DEFAULT 0,
    precio_coste            NUMERIC(10,4) NOT NULL CHECK (precio_coste >= 0),
    observaciones_compra    VARCHAR(255),
    PRIMARY KEY (id_compra, id_linea_compra)
);


-- ---------------------------------------------------------------------
-- 16. CONFIGURACION
-- Ajustes generales editables por el administrador (clave -> valor).
--   observaciones_pedidos -> pie general del PDF de los pedidos.
-- ---------------------------------------------------------------------
CREATE TABLE configuracion (
    clave  VARCHAR(50) PRIMARY KEY,
    valor  TEXT        NOT NULL DEFAULT ''
);


-- ---------------------------------------------------------------------
-- 17. PEDIDO_PDF
-- Último PDF enviado de cada pedido, para poder descargarlo después.
-- ---------------------------------------------------------------------
CREATE TABLE pedido_pdf (
    id_compra         INTEGER   PRIMARY KEY REFERENCES compra (id_compra) ON DELETE CASCADE,
    pdf               BYTEA     NOT NULL,
    con_precios       BOOLEAN   NOT NULL DEFAULT FALSE,
    fecha_generacion  TIMESTAMP NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- 18. EXPORTACIONES_XML
-- Un XML por pedido enviado, para importarlo en el ERP. Se crea al
-- enviar el pedido (no al reenviarlo) en estado PENDIENTE; al
-- descargarlo pasa a EXPORTADO. Solo el administrador lo borra.
-- ---------------------------------------------------------------------
CREATE TABLE exportaciones_xml (
    id_exportacion          SERIAL       PRIMARY KEY,
    id_compra               INTEGER      NOT NULL UNIQUE REFERENCES compra (id_compra) ON DELETE CASCADE,
    nombre_archivo          VARCHAR(40)  NOT NULL,
    contenido               TEXT         NOT NULL,
    estado                  VARCHAR(10)  NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EXPORTADO')),
    fecha_creacion          TIMESTAMP    NOT NULL DEFAULT NOW(),
    fecha_exportacion       TIMESTAMP,
    id_usuario_exportacion  INTEGER      REFERENCES usuarios (id_usuario) ON DELETE SET NULL
);


-- ---------------------------------------------------------------------
-- 19. PLANTILLAS_IMPORTACION
-- Cómo leer un archivo de datos (CSV, Excel o XML) para cargarlo en
-- proveedores, artículos o tarifas. "opciones" guarda cómo se lee el
-- archivo (separador, hoja, elemento de fila del XML) y "mapeo" qué
-- columna del archivo va a cada campo: {"codigo_erp": "COD_PROV", ...}.
-- ---------------------------------------------------------------------
CREATE TABLE plantillas_importacion (
    id_plantilla      SERIAL       PRIMARY KEY,
    nombre_plantilla  VARCHAR(100) NOT NULL UNIQUE,
    destino           VARCHAR(20)  NOT NULL CHECK (destino IN ('PROVEEDORES', 'ARTICULOS', 'TARIFAS')),
    formato           VARCHAR(10)  NOT NULL CHECK (formato IN ('CSV', 'EXCEL', 'XML')),
    opciones          JSONB        NOT NULL DEFAULT '{}',
    mapeo             JSONB        NOT NULL DEFAULT '{}',
    fecha_creacion    TIMESTAMP    NOT NULL DEFAULT NOW(),
    fecha_modificacion TIMESTAMP   NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- 20. PLANTILLAS_EXPORTACION
-- Formatos de descarga de los pedidos además del XML fijo del ERP.
-- "columnas" es la lista ordenada [{"campo": "articulo_codigo",
-- "titulo": "CODART"}, ...] y "opciones" cómo se escribe el archivo
-- (separador, decimal, formato de fecha, un archivo o uno por pedido,
-- nombres de los elementos del XML). Si marcar_exportado es TRUE,
-- descargar con esta plantilla marca los pedidos como EXPORTADOS.
-- ---------------------------------------------------------------------
CREATE TABLE plantillas_exportacion (
    id_plantilla       SERIAL       PRIMARY KEY,
    nombre_plantilla   VARCHAR(100) NOT NULL UNIQUE,
    formato            VARCHAR(10)  NOT NULL CHECK (formato IN ('CSV', 'EXCEL', 'XML')),
    columnas           JSONB        NOT NULL DEFAULT '[]',
    opciones           JSONB        NOT NULL DEFAULT '{}',
    marcar_exportado   BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_creacion     TIMESTAMP    NOT NULL DEFAULT NOW(),
    fecha_modificacion TIMESTAMP    NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------
-- SEGURIDAD: activamos "Row Level Security" en todas las tablas
-- y NO creamos ninguna política. Así la clave pública (anon) de
-- Supabase no puede leer ni modificar nada desde el navegador.
-- Nuestro backend se conecta con el usuario "postgres" (dueño de las
-- tablas), que no se ve afectado por RLS, así que él sí puede trabajar.
-- ---------------------------------------------------------------------
ALTER TABLE usuarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE articulos_tarificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_pedido      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_solicitud      ENABLE ROW LEVEL SECURITY;
ALTER TABLE compra                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas_compra         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sociedades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE centros               ENABLE ROW LEVEL SECURITY;
ALTER TABLE centro_emails_cc      ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_centros       ENABLE ROW LEVEL SECURITY;
ALTER TABLE centro_proveedores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE centro_articulos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE contadores_pedido     ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_pdf            ENABLE ROW LEVEL SECURITY;
ALTER TABLE exportaciones_xml     ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_importacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_exportacion ENABLE ROW LEVEL SECURITY;
