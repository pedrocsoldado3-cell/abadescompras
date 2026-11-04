-- =====================================================================
-- ARCHIVO: 02_datos_prueba.sql
-- Mete datos de ejemplo para poder probar la aplicación nada más
-- instalarla. Se ejecuta DESPUÉS de 01_tablas.sql.
-- =====================================================================


-- ---------------------------------------------------------------------
-- USUARIOS DE PRUEBA
-- Las contraseñas NO se guardan en claro: aquí está su hash bcrypt.
--   admin    -> contraseña: Admin1234
--   empleado -> contraseña: Usuario1234
--   invitado -> contraseña: Usuario1234 (registrado pero sin activar)
-- Los hashes se generaron con: node -e "console.log(require('bcryptjs').hashSync('Admin1234',10))"
-- ---------------------------------------------------------------------
INSERT INTO usuarios (nombre_usuario, nombre_completo, rol, email_usuario, contrasena, activo_usuario) VALUES
('admin',    'Administrador de central', 'ADMIN',   'admin@empresa.com',    '$2b$10$d.nkrZLqNyMnQhyr9lstEeCDkge/1O.ybTRjv63Cjh2Q4uARJpfMq', TRUE),
('empleado', 'Laura Gómez Ruiz',              'USUARIO', 'empleado@empresa.com', '$2b$10$rvFZK6Ie2ovSBEKK9SRY0.2kkWjYCDfVx1u.Jg2hfF8rLwKQPq2XW', TRUE),
('invitado', 'Mario Pérez León',              NULL,      'invitado@empresa.com', '$2b$10$rvFZK6Ie2ovSBEKK9SRY0.2kkWjYCDfVx1u.Jg2hfF8rLwKQPq2XW', FALSE);


-- ---------------------------------------------------------------------
-- PROVEEDORES DE PRUEBA (3 proveedores, el último desactivado)
-- ---------------------------------------------------------------------
INSERT INTO proveedores (codigo_erp, nombre_proveedor, razon_social, cif, direccion, cod_postal, provincia, localidad, telefono, email_proveedor, activo_proveedor) VALUES
(5839, 'Distribuciones Sur', 'Distribuciones Sur S.L.',   'B14000001', 'C/ Gran Capitán 10', '14001', 'Córdoba', 'Córdoba', '957000001', 'pedidos@dsur.com',     TRUE),
(565, 'Bebidas Mezquita',   'Bebidas Mezquita S.A.',     'A14000002', 'Polígono Chinales 5', '14007', 'Córdoba', 'Córdoba', '957000002', 'ventas@bmezquita.com', TRUE),
(5901, 'Frutas Guadalquivir','Frutas Guadalquivir S.Coop','F14000003', 'Mercado Central 3',  '14002', 'Córdoba', 'Córdoba', '957000003', 'frutas@guadal.com',    FALSE);


-- ---------------------------------------------------------------------
-- ARTÍCULOS (catálogo maestro)
-- ---------------------------------------------------------------------
INSERT INTO articulos (codigo_erp, ean, descripcion_articulo, iva, activo_articulo) VALUES
(79925, '8410000000011', 'Coca-Cola lata 33 cl (caja 24 ud)',     10.00, TRUE),
(82528, '8410000000028', 'Agua mineral 50 cl (pack 24 ud)',        10.00, TRUE),
(80519, '8410000000035', 'Aceite de oliva virgen extra 5 L',        4.00, TRUE),
(193522, '8410000000042', 'Café en grano 1 kg',                     10.00, TRUE),
(127240, '8410000000059', 'Servilletas papel 30x30 (paquete 100)',  21.00, TRUE),
(90001, '8410000000066', 'Tomate pera (kg)',                        4.00, FALSE);


-- ---------------------------------------------------------------------
-- ARTÍCULOS TARIFICADOS (precio de cada artículo en cada proveedor)
-- Algunos artículos tienen dos proveedores para comprobar que el motor
-- elige el precio neto más bajo:  neto = precio - (precio * descuento / 100)
--   Coca-Cola: Sur 14,00 -10% = 12,60  | Mezquita 13,00 -0% = 13,00 -> gana Sur
--   Agua:      Sur  4,00 -0%  =  4,00  | Mezquita  4,50 -15% = 3,825 -> gana Mezquita
--   Café:      Sur 12,00 -0%  = 12,00  | Mezquita 12,00 -0%  = 12,00 -> empate, gana id_proveedor más bajo (Sur)
-- ---------------------------------------------------------------------
INSERT INTO articulos_tarificados (id_articulo, id_proveedor, descripcion_proveedor, referencia_proveedor, precio, descuento, activo_articulo_tarificado) VALUES
(1, 1, 'COCA COLA 33CL C/24',       'DS-COCA24',  14.0000, 10.00, TRUE),
(1, 2, 'Refresco cola lata x24',     'BM-1001',    13.0000,  0.00, TRUE),
(2, 1, 'AGUA 50CL P/24',             'DS-AGUA24',   4.0000,  0.00, TRUE),
(2, 2, 'Agua mineral pack 24',       'BM-2002',     4.5000, 15.00, TRUE),
(3, 1, 'AOVE GARRAFA 5L',            'DS-AOVE5',   32.5000,  5.00, TRUE),
(4, 1, 'CAFE GRANO 1KG',             'DS-CAFE1',   12.0000,  0.00, TRUE),
(4, 2, 'Café grano natural 1 kg',    'BM-3003',    12.0000,  0.00, TRUE),
(6, 3, 'Tomate pera granel',         'FG-TOM',      1.2000,  0.00, TRUE);
-- Nota: las servilletas (artículo 5) no tienen ninguna tarifa, así que
-- NO aparecen en el catálogo del usuario.


-- ---------------------------------------------------------------------
-- SOCIEDADES Y CENTROS DE PRUEBA
-- Dos razones sociales; la primera tiene dos centros.
-- ---------------------------------------------------------------------
INSERT INTO sociedades (razon_social, cif, dir_fiscal, cp_fiscal, localidad_fiscal, provincia_fiscal) VALUES
('Hoteles del Sur S.L.',    'B14111111', 'Av. de la Libertad 1', '14005', 'Córdoba', 'Córdoba'),
('Restauración Costa S.A.', 'A29222222', 'Paseo Marítimo 20',    '29016', 'Málaga',  'Málaga');

INSERT INTO centros (id_sociedad, numero_serie, numero_almacen, nombre_centro, telefono_1, telefono_2, responsable,
                     dir_entrega, cp_entrega, localidad_entrega, provincia_entrega, observaciones_entrega, email_envio) VALUES
(1, '3A', '450', 'Hotel Centro - Economato', '957100001', NULL,        'Ana Ruiz',
 'C/ Claudio Marcelo 5', '14002', 'Córdoba', 'Córdoba', 'Entrega de 8:00 a 11:00 por la puerta de servicio.', 'economato3a@empresa.com'),
(1, '4A', '451', 'Hotel Sierra - Economato', '957100002', '600100002', NULL,
 'Ctra. de las Ermitas km 3', '14012', 'Córdoba', 'Córdoba', NULL, 'economato4a@empresa.com'),
(2, '7A', '700', 'Hotel Playa - Economato',  '952200001', NULL,        'Luis Martín',
 'Paseo Marítimo 22', '29016', 'Málaga', 'Málaga', 'Muelle de carga trasero.', 'economato7a@empresa.com');

INSERT INTO centro_emails_cc (id_centro, email) VALUES
(1, 'direccion3a@empresa.com'),
(1, 'cocina3a@empresa.com'),
(3, 'direccion7a@empresa.com');

-- El usuario "empleado" puede pedir para los dos centros de Córdoba.
INSERT INTO usuario_centros (id_usuario, id_centro) VALUES (2, 1), (2, 2);

-- Proveedores habilitados por centro.
INSERT INTO centro_proveedores (id_centro, id_proveedor) VALUES
(1, 1), (1, 2),
(2, 1),
(3, 2), (3, 3);

-- Catálogo de cada centro.
INSERT INTO centro_articulos (id_centro, id_articulo) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5),
(2, 1), (2, 3), (2, 4),
(3, 1), (3, 2), (3, 4);


-- ---------------------------------------------------------------------
-- CONFIGURACIÓN: pie general del PDF de pedidos.
-- ---------------------------------------------------------------------
INSERT INTO configuracion (clave, valor) VALUES
('observaciones_pedidos', 'En todos los albaranes debe aparecer nuestro número de pedido.
En el albarán los artículos deben tener el mismo orden que nuestro pedido.
Debe venir un albarán por pedido.');

UPDATE centros SET observaciones_pedido = 'Si no se puede servir alguna referencia, comuníquelo al economato antes de la entrega.' WHERE numero_serie = '3A';
