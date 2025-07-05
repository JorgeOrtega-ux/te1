<?php
// ========================================
// LANGUAGE DETECTOR
// ========================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Listas de países por idioma
$spanishCountries = [
    'es', 'es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-VE', 'es-PE', 'es-CL', 
    'es-EC', 'es-GT', 'es-CU', 'es-BO', 'es-DO', 'es-HN', 'es-PY', 'es-SV',
    'es-NI', 'es-CR', 'es-PA', 'es-UY', 'es-PR', 'es-GQ'
];

$englishCountries = [
    'en', 'en-US', 'en-GB', 'en-CA', 'en-AU', 'en-NZ', 'en-ZA', 'en-IE',
    'en-IN', 'en-SG', 'en-PH', 'en-MY', 'en-NG', 'en-KE', 'en-GH', 'en-UG',
    'en-TZ', 'en-ZW', 'en-BW', 'en-JM', 'en-TT', 'en-BS', 'en-BB', 'en-BZ',
    'en-GY', 'en-AG', 'en-DM', 'en-GD', 'en-KN', 'en-LC', 'en-VC'
];

$frenchCountries = [
    'fr', 'fr-FR', 'fr-CA', 'fr-BE', 'fr-CH', 'fr-LU', 'fr-MC', 'fr-CD',
    'fr-CG', 'fr-CI', 'fr-CM', 'fr-BF', 'fr-NE', 'fr-ML', 'fr-SN', 'fr-MG',
    'fr-MA', 'fr-TN', 'fr-DZ', 'fr-HT', 'fr-GF', 'fr-GP', 'fr-MQ', 'fr-RE',
    'fr-YT', 'fr-NC', 'fr-PF', 'fr-WF', 'fr-PM', 'fr-BL', 'fr-MF'
];

function detectLanguage($browserLanguage) {
    global $spanishCountries, $englishCountries, $frenchCountries;
    
    // Normalizar el idioma del navegador
    $browserLanguage = strtolower(trim($browserLanguage));
    
    // Buscar coincidencia exacta primero
    if (in_array($browserLanguage, $spanishCountries)) {
        return 'es-mx';
    }
    
    if (in_array($browserLanguage, $englishCountries)) {
        return 'en-us';
    }
    
    if (in_array($browserLanguage, $frenchCountries)) {
        return 'fr-fr';
    }
    
    // Si no hay coincidencia exacta, buscar por prefijo
    $languagePrefix = explode('-', $browserLanguage)[0];
    
    switch ($languagePrefix) {
        case 'es':
            return 'es-mx';
        case 'en':
            return 'en-us';
        case 'fr':
            return 'fr-fr';
        default:
            // Por defecto, devolver inglés
            return 'en-us';
    }
}

function logLanguageDetection($browserLanguage, $detectedLanguage) {
    $logData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'browser_language' => $browserLanguage,
        'detected_language' => $detectedLanguage,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'Unknown'
    ];
    
    // Opcional: guardar en archivo de log
    // file_put_contents('language_detection.log', json_encode($logData) . "\n", FILE_APPEND);
}

// ========================================
// PROCESAMIENTO DE LA SOLICITUD
// ========================================

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        // Leer datos JSON
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        if (!$data || !isset($data['browserLanguage'])) {
            http_response_code(400);
            echo json_encode([
                'error' => 'Missing browserLanguage parameter',
                'detectedLanguage' => 'en-us'
            ]);
            exit;
        }
        
        $browserLanguage = $data['browserLanguage'];
        $detectedLanguage = detectLanguage($browserLanguage);
        
        // Log opcional para debugging
        logLanguageDetection($browserLanguage, $detectedLanguage);
        
        // Respuesta exitosa
        echo json_encode([
            'success' => true,
            'browserLanguage' => $browserLanguage,
            'detectedLanguage' => $detectedLanguage,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Internal server error: ' . $e->getMessage(),
            'detectedLanguage' => 'en-us'
        ]);
    }
} else {
    http_response_code(405);
    echo json_encode([
        'error' => 'Method not allowed. Use POST.',
        'detectedLanguage' => 'en-us'
    ]);
}
?>