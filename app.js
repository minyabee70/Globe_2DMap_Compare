// 지구본 vs 평면도법 비교 학습 사이트 메인 스크립트

// 1. 애플리케이션 상태 관리
const state = {
    rotation: [0, 0, 0], // lambda (경도), phi (위도), gamma (회전)
    projectionName: 'mercator',
    simulationMode: 'tissot', // 'tissot' (지시타원) 또는 'shapes' (커스텀/템플릿 도형)
    tissotSize: 4.4966,       // 팃소 지시타원 반지름 (도 단위, 약 500km에 매칭)
    tissotDensity: 30,        // 팃소 원의 배치 간격 (도 단위)
    activeTemplate: 'equator-circles', // 'equator-circles', 'greenland-africa', 'bermuda-triangle', 'user-draw'
    userPolygonPoints: [],    // 사용자가 그린 다각형 경위도 점들 [[lon, lat], ...]
    isDrawing: false,
    zoomScale: 1.0,           // 3D와 2D가 공유하는 공통 줌 확대율 (1.0배 ~ 8.0배)
    selectedShapeId: null,    // 현재 양방향 선택/하이라이트 처리된 도형의 ID
    geoData: null             // World Atlas GeoJSON 데이터
};

// 2. 도법별 메타데이터 (설명 및 왜곡 특성)
const PROJECTION_DETAILS = {
    mercator: {
        name: "메르카토르 도법 (Mercator)",
        type: "등각도법 (Conformal)",
        distortion: "면적 왜곡: 극도로 높음",
        areaDistortionValue: 90, // 시각적 게이지 백분율 (최대치 대비)
        shapeDistortionValue: 0,
        areaText: "무한대 (∞)",
        shapeText: "0% (형태 완전 보존)",
        desc: "네덜란드의 지도학자 메르카토르가 1569년에 발표한 원통도법입니다. 지도 상의 임의의 두 지점을 잇는 직선이 자오선과 이루는 각도가 지구상의 각도와 완전히 일치하는 '등각' 성질을 가집니다. 항해 시 나침반 각도를 유지하며 항로를 그릴 수 있어 대항해 시대의 표준이 되었습니다. 그러나 적도에서 고위도로 갈수록 면적이 무한대로 확대되어 그린란드(실제 아프리카의 1/14 크기)가 아프리카와 비슷하게 보이는 치명적인 면적 왜곡이 존재합니다. 현재 구글 지도 등 주요 웹 지도 서비스의 기본 뼈대로 널리 사용되고 있습니다.",
        usages: "해상 항해용 해도, 항공용 종이 내비게이션 지도, Google Maps 및 카카오/네이버 지도 등 최신 글로벌 웹 기반 지도 서비스(Web Mercator)의 줌 레벨 정합 표준 타일 지도."
    },
    equirectangular: {
        name: "정거원통 도법 (Equirectangular)",
        type: "정거리원통도법 (Plate Carrée)",
        distortion: "면적 및 형태 왜곡: 보통",
        areaDistortionValue: 50,
        shapeDistortionValue: 40,
        areaText: "위도에 비례하여 증가",
        shapeText: "고위도에서 좌우 신장",
        desc: "지구의 경도와 위도를 직교 격자 좌표계(X=경도, Y=위도)에 그대로 1:1로 사영한 가장 단순한 도법입니다. 제작이 매우 쉬워 컴퓨터 지리 정보 시스템(GIS)에서 원시 데이터를 다룰 때 널리 쓰입니다. 적도선상에서는 거리와 면적이 정확하지만, 고위도로 갈수록 위도선들이 길어져 가로 방향으로 찌그러지고 면적이 커집니다. 형태와 면적 중 어느 것도 온전히 보존하지 못하지만 극지방의 수치 왜곡이 메르카토르처럼 기하급수적으로 폭발하지는 않습니다.",
        usages: "지리 정보 시스템(GIS) 원시 경위도 데이터베이스 분석, 360도 VR 파노라마 이미지 포맷 매핑, 3D 컴퓨터 그래픽(WebGL/Three.js)의 지구 표면 텍스처 UV 매핑 좌표 표현."
    },
    mollweide: {
        name: "몰바이데 도법 (Mollweide)",
        type: "등적도법 (Equal-area / Homolographic)",
        distortion: "형태 왜곡: 보통 ~ 높음",
        areaDistortionValue: 0,
        shapeDistortionValue: 70,
        areaText: "0% (면적 완전 보존)",
        shapeText: "변두리로 갈수록 심한 찌그러짐",
        desc: "1805년 몰바이데가 고안한 의원통 등적도법입니다. 전체 세계 지도를 타원형(장축:단축 = 2:1)으로 표현하며, 지도의 모든 지점에서 실제 면적의 비율이 구면 상과 정확히 유지되는 '등적' 성질을 가집니다. 이에 따라 대륙 간의 실제 크기를 비교하는 인구 분포도, 기후도, 삼림 분포도 등의 주제도에 필수적으로 사용됩니다. 그러나 면적을 보존하기 위해 주변부로 갈수록 형태(각도)가 급격하게 찌그러지고 기울어지는 형태 왜곡이 나타납니다.",
        usages: "글로벌 인구 분포 밀도 대조 분석 지도, 전 세계 식생 및 삼림 기후 기후도, 지구 물리학 분야의 전 지구 자기장 지도, 천체 물리학의 우주 배경 복사(CMB) 및 은하 전천 관측 성도."
    },
    robinson: {
        name: "로빈슨 도법 (Robinson)",
        type: "절충도법 (Compromise / Pseudo-cylindrical)",
        distortion: "면적 및 형태 왜곡: 낮음 (균형)",
        areaDistortionValue: 35,
        shapeDistortionValue: 30,
        areaText: "제한된 왜곡",
        shapeText: "주변부 약한 왜곡",
        desc: "1963년 아서 로빈슨이 개발한 도법으로, 특정 요소를 완벽히 보존하기보다는 전체적인 왜곡의 합을 최소화하여 '보기에 가장 자연스러운 세계지도'를 만드는 것을 목표로 고안된 절충도법입니다. 등각도 아니고 등적도 아니지만, 시각적인 조화가 뛰어나 내셔널 지오그래픽 협회 등에서 수십 년간 표준 세계지도로 채택하였습니다. 극지방을 점이 아닌 일정한 선분으로 나타내어 전체적인 균형을 잡았습니다.",
        usages: "일반 교육용 및 출판용 세계 전도(World Map), 세계 지리학 교과서 삽화, 내셔널 지오그래픽 협회 공식 출판물 및 보도 매체의 시각 그래픽 지도."
    },
    azimuthalEqualArea: {
        name: "람베르트 방위등적 도법 (Azimuthal Equal Area)",
        type: "방위등적도법 (Equal-area Azimuthal)",
        distortion: "방향 및 형태 왜곡: 보통",
        areaDistortionValue: 0,
        shapeDistortionValue: 50,
        areaText: "0% (면적 완전 보존)",
        shapeText: "외곽부 동심원 방향 찌그러짐",
        desc: "1772년 람베르트가 고안한 도법으로, 투영 중심으로부터 모든 지점까지의 면적 비율이 정확하게 보존되는 등적 성질과 동시에, 중심점에서 나아가는 직선 방향(방위각)이 지구상의 실제 대원(Great Circle) 경로와 일치하는 특성을 지닙니다. 따라서 대륙 단위나 대륙 전체의 등적 비교 및 대권 항로 분석에 자주 이용됩니다. 중심에서 멀어질수록 반경 방향은 축소되고 원주 방향은 신장되어 심한 형태 왜곡이 발생하지만 전체 지도의 총면적은 실제 구면과 항상 같습니다.",
        usages: "북극 및 남극 탐사용 극지방 통계 지도, 해양학 분야의 글로벌 해류 흐름 분석도, 미국 지질조사국(USGS) 배포 북미 대륙 단위 자원 매장량 비교 및 생태 관측 주제도."
    }
};

// 3. UI 및 그래픽 설정 상수
let globeWidth = 350, globeHeight = 350;
let mapWidth = 550, mapHeight = 350;

// SVG 요소 선택 및 크기 설정
const globeSvg = d3.select("#globe-container").append("svg")
    .attr("viewBox", `0 0 ${globeWidth} ${globeHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

const mapSvg = d3.select("#map-container").append("svg")
    .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

// SVG 그라데이션 필터 정의 (3D 지구 입체감 향상)
const defs = globeSvg.append("defs");
const globeGrad = defs.append("radialGradient")
    .attr("id", "globe-grad")
    .attr("cx", "30%")
    .attr("cy", "30%")
    .attr("r", "70%");
globeGrad.append("stop").attr("offset", "0%").attr("stop-color", "#2563eb").attr("stop-opacity", 0.6);
globeGrad.append("stop").attr("offset", "50%").attr("stop-color", "#0f172a").attr("stop-opacity", 0.9);
globeGrad.append("stop").attr("offset", "100%").attr("stop-color", "#020617").attr("stop-opacity", 1);

// 4. D3 투영법 객체 인스턴스 생성
const globeProjection = d3.geoOrthographic()
    .scale(150 * state.zoomScale)
    .translate([globeWidth / 2, globeHeight / 2])
    .clipAngle(90)
    .precision(0.1);

const mapProjections = {
    mercator: d3.geoMercator().scale(80).translate([mapWidth / 2, mapHeight / 2]).precision(0.1),
    equirectangular: d3.geoEquirectangular().scale(80).translate([mapWidth / 2, mapHeight / 2]).precision(0.1),
    mollweide: d3.geoMollweide().scale(90).translate([mapWidth / 2, mapHeight / 2]).precision(0.1),
    robinson: d3.geoRobinson().scale(85).translate([mapWidth / 2, mapHeight / 2]).precision(0.1),
    azimuthalEqualArea: d3.geoAzimuthalEqualArea().scale(80).translate([mapWidth / 2, mapHeight / 2]).precision(0.1)
};

// D3 Path 생성기
const globePath = d3.geoPath().projection(globeProjection);
let mapPath = d3.geoPath().projection(mapProjections[state.projectionName]);

// 격자선 생성기 (15도 간격)
const graticule = d3.geoGraticule().step([15, 15]);

// 5. 기본 그룹 레이어 설정
// 지구본 레이어 구성
const globeOcean = globeSvg.append("circle")
    .attr("cx", globeWidth / 2)
    .attr("cy", globeHeight / 2)
    .attr("r", 150 * state.zoomScale)
    .attr("class", "ocean");

const globeGlow = globeSvg.append("circle")
    .attr("cx", globeWidth / 2)
    .attr("cy", globeHeight / 2)
    .attr("r", 150 * state.zoomScale)
    .attr("class", "globe-glow")
    .style("pointer-events", "none");

const globeGraticuleLayer = globeSvg.append("path")
    .datum(graticule)
    .attr("class", "graticule")
    .attr("d", globePath);

const globeLandLayer = globeSvg.append("g").attr("class", "land-group");

const globeTissotLayer = globeSvg.append("g").attr("class", "tissot-group");
const globeShapesLayer = globeSvg.append("g").attr("class", "shapes-group");
const globeDrawLayer = globeSvg.append("g").attr("class", "draw-group");

const globeOutline = globeSvg.append("circle")
    .attr("cx", globeWidth / 2)
    .attr("cy", globeHeight / 2)
    .attr("r", 150 * state.zoomScale)
    .attr("class", "globe-outline")
    .style("pointer-events", "none");

// 평면 지도 레이어 구성
// 평면지도의 경우, 도법 경계(외곽선)를 그리지 않고 미니멀하게 격자와 육지선만 표시합니다.

const mapGraticuleLayer = mapSvg.append("path")
    .datum(graticule)
    .attr("class", "graticule");

const mapLandLayer = mapSvg.append("g").attr("class", "land-group");

const mapTissotLayer = mapSvg.append("g").attr("class", "tissot-group");
const mapShapesLayer = mapSvg.append("g").attr("class", "shapes-group");
const mapDrawLayer = mapSvg.append("g").attr("class", "draw-group");

// 6. 데이터 로드 및 초기화
d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
    .then(world => {
        state.geoData = topojson.feature(world, world.objects.countries);
        
        // 로딩 완료 UI 표시 변경
        const badge = d3.select("#loading-indicator");
        badge.text("준비 완료").classed("loading", false).classed("success", true);
        
        // 데이터 렌더링
        drawLand();
        updateViews();
        setupInteractions();
    })
    .catch(error => {
        console.error("지리 데이터를 가져오는 중 오류 발생:", error);
        d3.select("#loading-indicator").text("오류 발생").style("background", "red");
    });

// 육지 그리기 함수
function drawLand() {
    if (!state.geoData) return;

    // 지구본 육지 바인딩
    globeLandLayer.selectAll("path")
        .data(state.geoData.features)
        .enter().append("path")
        .attr("class", "land")
        .attr("d", globePath);

    // 평면 지도 육지 바인딩
    mapLandLayer.selectAll("path")
        .data(state.geoData.features)
        .enter().append("path")
        .attr("class", "land")
        .attr("d", mapPath);
}

// 7. 실시간 뷰 업데이트 함수 (핵심 렌더링 동기화 루프)
function updateViews() {
    // 3D 지구본 투영 업데이트
    globeProjection.rotate(state.rotation);
    globePath.projection(globeProjection);
    globeGraticuleLayer.attr("d", globePath);
    globeLandLayer.selectAll("path").attr("d", globePath);

    // 평면 지도 투영 업데이트
    const activeProj = mapProjections[state.projectionName];
    
    // 도법 중심도 지구본의 회전 방향에 맞추어 동기화합니다.
    // 메르카토르 등의 가로 흐름을 자연스럽게 하기 위해 경도(lambda) 회전만 적용하거나
    // 전체 구면 회전(lambda, phi)을 적용해줍니다.
    // 여기서는 등적/등각 왜곡의 다이내믹한 비교를 위해 경도(lambda)와 위도(phi) 모두 평면지도 투영에 전달합니다.
    // 단, Robinson이나 Mollweide처럼 고정 위주 맵의 경우 강제 동기화 시 독특한 형태가 되는데, 이것이 도법의 속성을 학습하기 좋습니다.
    activeProj.rotate(state.rotation);
    
    mapPath = d3.geoPath().projection(activeProj);
    mapGraticuleLayer.attr("d", mapPath);
    mapLandLayer.selectAll("path").attr("d", mapPath);

    // 3D와 2D의 확대정도 및 중심점을 일치시키기 위한 2D 트랜스폼 연산
    // 지도의 정중앙 [mapWidth/2, mapHeight/2]을 줌 중심으로 강제 고정
    const k = state.zoomScale;
    const tx = (mapWidth / 2) * (1 - k);
    const ty = (mapHeight / 2) * (1 - k);
    const customTransform = `translate(${tx}, ${ty}) scale(${k})`;

    mapGraticuleLayer.attr("transform", customTransform);
    mapLandLayer.attr("transform", customTransform);
    mapTissotLayer.attr("transform", customTransform);
    mapShapesLayer.attr("transform", customTransform);
    mapDrawLayer.attr("transform", customTransform);

    // 화면 좌표 텍스트 업데이트
    d3.select("#globe-rotation").text(
        `${state.rotation[0].toFixed(2)}°, ${state.rotation[1].toFixed(2)}°`
    );

    // 팃소 지시타원 및 도형 렌더링 업데이트
    if (state.simulationMode === 'tissot') {
        renderTissot();
    } else {
        renderCustomShapes();
    }
}

// 8. 팃소의 지시타원(Tissot's Indicatrix) 생성 및 렌더링 (클릭 상호작용 지원)
function renderTissot() {
    // 이전 그리기 요소 삭제
    globeTissotLayer.selectAll("*").remove();
    mapTissotLayer.selectAll("*").remove();
    globeShapesLayer.selectAll("*").remove();
    mapShapesLayer.selectAll("*").remove();
    globeDrawLayer.selectAll("*").remove();
    mapDrawLayer.selectAll("*").remove();

    const circles = [];
    const density = state.tissotDensity;
    const radius = state.tissotSize;

    // 구면 상의 경위도 교차점에 팃소 원 생성
    let initialFocus = null;
    for (let lat = -90 + density/2; lat < 90; lat += density) {
        for (let lon = -180; lon < 180; lon += density) {
            const circleGenerator = d3.geoCircle()
                .center([lon, lat])
                .radius(radius);
            
            const circleFeat = {
                type: "Feature",
                geometry: circleGenerator(),
                properties: { 
                    center: [lon, lat],
                    label: `지시타원 (위도 ${lat.toFixed(0)}°, 경도 ${lon.toFixed(0)}°)`,
                    id: `tissot-${lon.toFixed(0)}-${lat.toFixed(0)}`
                }
            };
            circles.push(circleFeat);
            
            // 적도선 부근의 원을 초기 포커스로 지정
            if (lat === 15 || lat === -15 || lat === 0) {
                if (lon === 0 || lon === 30 || lon === -30) {
                    initialFocus = circleFeat;
                }
            }
        }
    }

    if (!initialFocus && circles.length > 0) {
        initialFocus = circles[0];
    }

    // 팃소 지시타원 모드 최초 진입 또는 템플릿 전환 시 선택 ID 연동
    if (initialFocus && (!state.selectedShapeId || !state.selectedShapeId.startsWith('tissot'))) {
        state.selectedShapeId = initialFocus.properties.id;
    }

    // 3D 지구본 렌더링
    globeTissotLayer.selectAll("path")
        .data(circles)
        .enter().append("path")
        .attr("class", classMapper)
        .attr("d", globePath)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            event.stopPropagation();
            selectTissotCircle(d);
        });

    // 2D 평면 지도 렌더링
    mapTissotLayer.selectAll("path")
        .data(circles)
        .enter().append("path")
        .attr("class", classMapper)
        .attr("d", mapPath)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            event.stopPropagation();
            selectTissotCircle(d);
        });

    // 현재 선택된 팃소 원의 분석 데이터 노출
    const currentSelected = circles.find(c => c.properties.id === state.selectedShapeId) || initialFocus;
    calculateDistortion(currentSelected);
}

// 팃소 지시타원 클릭 선택 헬퍼 함수
function selectTissotCircle(feature) {
    if (!feature || !feature.properties) return;
    state.selectedShapeId = feature.properties.id;
    
    // 3D/2D 지시타원 레이어 전체의 CSS 클래스를 실시간 재적용하여 하이라이트 스타일 업데이트
    globeTissotLayer.selectAll("path").attr("class", classMapper);
    mapTissotLayer.selectAll("path").attr("class", classMapper);
    
    // 우측 및 대시보드 왜곡 데이터 업데이트
    calculateDistortion(feature);
}

// 9. 도형 시뮬레이터 렌더링 및 실시간 분석 계산
function renderCustomShapes() {
    globeTissotLayer.selectAll("*").remove();
    mapTissotLayer.selectAll("*").remove();
    globeShapesLayer.selectAll("*").remove();
    mapShapesLayer.selectAll("*").remove();

    let shapes = [];
    let focusedShape = null; // 왜곡 지표 계산의 대상이 될 대표 도형

    if (state.activeTemplate === 'equator-circles') {
        // 1. 적도와 극지의 원 비교 - 반경 500km(각도 4.4966도)로 통일
        const r = 4.4966;
        const pts = [
            { center: [0, 0], label: "적도의 원" },
            { center: [0, 45], label: "중위도의 원" },
            { center: [0, 75], label: "고위도의 원" }
        ];
        
        pts.forEach((p, idx) => {
            const circleGen = d3.geoCircle().center(p.center).radius(r);
            const feat = {
                type: "Feature",
                geometry: circleGen(),
                properties: { label: p.label, id: 'circle-' + idx }
            };
            shapes.push(feat);
            // 현재 구면 상의 중심에 가깝게 카메라가 돌아가 있을 때 분석 대상을 동적으로 고르면 좋지만
            // 기본적으로 극지 왜곡을 극적으로 보여주기 위해 '고위도의 원'을 주 분석 대상으로 선택
            if (idx === 2) focusedShape = feat;
        });

    } else if (state.activeTemplate === 'greenland-africa') {
        // 2. 그린란드 vs 아프리카 면적 왜곡 비교 (동일한 크기의 가상 면적 디스크 - 반경 500km로 수정)
        const r = 4.4966;
        const featGreenland = {
            type: "Feature",
            geometry: d3.geoCircle().center([-40, 72]).radius(r)(),
            properties: { label: "그린란드 비교원", id: "greenland" }
        };
        const featAfrica = {
            type: "Feature",
            geometry: d3.geoCircle().center([20, 10]).radius(r)(),
            properties: { label: "아프리카 비교원", id: "africa" }
        };
        shapes.push(featGreenland, featAfrica);
        focusedShape = featGreenland; // 그린란드를 포커싱하여 아프리카 대비 면적이 얼마나 비대해지는지 산출

    } else if (state.activeTemplate === 'bermuda-triangle') {
        // 3. 다각형 다중 비교 (3각 ~ 10각 정다각형군을 위도별 3개 행렬 그리드로 확장 배치)
        const radius = 4.4966; // 다각형의 반지름 (도 단위, 물리 반경 500km 매칭)
        const lats = [0, 45, 70]; // 적도, 중위도, 고위도 3개 위도선 고정
        const centers = [
            { lon: -85, sides: 3, label: "삼각형" },
            { lon: -60, sides: 4, label: "사각형" },
            { lon: -35, sides: 5, label: "오각형" },
            { lon: -10, sides: 6, label: "육각형" },
            { lon: 15,  sides: 7, label: "칠각형" },
            { lon: 40,  sides: 8, label: "팔각형" },
            { lon: 65,  sides: 9, label: "구각형" },
            { lon: 90,  sides: 10, label: "십각형" }
        ];

        lats.forEach(latVal => {
            const cosLat = Math.cos(latVal * Math.PI / 180);
            const latLabel = latVal === 0 ? "적도" : latVal === 45 ? "중위도" : "고위도";
            
            centers.forEach((c) => {
                const coords = [];
                for (let i = 0; i <= c.sides; i++) {
                    const angle = - (i * 2 * Math.PI) / c.sides - Math.PI / 2; // 반시계 방향 회전
                    const ptLon = c.lon + (radius * Math.cos(angle)) / cosLat;
                    const ptLat = latVal + radius * Math.sin(angle);
                    coords.push([ptLon, ptLat]);
                }
                
                const polyFeat = {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [coords]
                    },
                    properties: { 
                        label: `${latLabel} ${c.label}`, 
                        id: `poly-${c.sides}-${latVal}` 
                    }
                };
                shapes.push(polyFeat);
                
                // 기본 포커스 분석은 적도의 오각형으로 지정
                if (c.sides === 5 && latVal === 0) focusedShape = polyFeat;
            });
        });
    } else if (state.activeTemplate === 'rectangles') {
        // 4. 구면 상의 사각형 비교 (물리 한 변 1000km 정사각형 규격 보정)
        // 적도 사각형: 가로/세로 폭 8.983도
        const rectEquator = createInterpolatedRect(-4.4915, 4.4915, -4.4915, 4.4915, "적도의 사각형", "rect-equator");
        // 중위도 사각형(위도 45도): 세로 폭 8.983도, 가로 폭 12.704도 (위도 코사인 보정 1.414배)
        const rectMiddle = createInterpolatedRect(-6.352, 6.352, 40.5085, 49.4915, "중위도의 사각형", "rect-middle");
        // 고위도 사각형(위도 60도): 세로 폭 8.983도, 가로 폭 17.966도 (위도 코사인 보정 2배)
        const rectHigh = createInterpolatedRect(-8.983, 8.983, 55.5085, 64.4915, "고위도의 사각형", "rect-high");
        shapes.push(rectEquator, rectMiddle, rectHigh);
        focusedShape = rectHigh;
    } else if (state.activeTemplate === 'equator-straddle') {
        // 5. 적도 위아래로 걸쳐지는 도형 세트 (원, 사각형, 다각형 각각 1개씩 적도 대칭 배치)
        const straddleCircle = {
            type: "Feature",
            geometry: d3.geoCircle().center([0, 0]).radius(4.4966)(),
            properties: { label: "적도 걸침 원", id: "circle-straddle" }
        };
        
        // 사각형: 물리 한 변 1000km 정사각형 (서경 -35도 중심 오프셋 반영 -> 경도 -39.4915 ~ -30.5085도 범위)
        const straddleRect = createInterpolatedRect(-39.4915, -30.5085, -4.4915, 4.4915, "적도 걸침 사각형", "rect-straddle");
        
        const straddlePoly = {
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [0, 15], [15, 0], [0, -15], [-15, 0], [0, 15]
                ]]
            },
            properties: { label: "적도 걸침 다각형 (다이아몬드)", id: "poly-straddle" }
        };
        // 다각형: 경도 15 ~ 45도 범위
        straddlePoly.geometry.coordinates[0] = straddlePoly.geometry.coordinates[0].map(pt => [pt[0] + 35, pt[1]]);
        
        shapes.push(straddleCircle, straddleRect, straddlePoly);
        focusedShape = straddleCircle; // 분석 대표로 원을 지정
        
    } else if (state.activeTemplate === 'meridian-strip') {
        // 6. 북위 80도부터 남위 80도까지 길게 그려지는 형태들
        // A. 남북 종단 자오선 띠 사각형 (D3 촘촘한 세그먼트로 보간하여 그리기)
        const stripCoords = [];
        // 왼쪽 경선 (경도 -8)을 먼저 위로 수집
        for (let lat = -80; lat <= 80; lat += 5) {
            stripCoords.push([-8, lat]);
        }
        // 오른쪽 경선 (경도 8)을 아래로 수집
        for (let lat = 80; lat >= -80; lat -= 5) {
            stripCoords.push([8, lat]);
        }
        stripCoords.push([-8, -80]); // 폐곡선 닫기
        
        const meridianRect = {
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [stripCoords]
            },
            properties: { label: "남북 종단 거대 사각형 (±80°)", id: "rect-meridian-strip" }
        };
        shapes.push(meridianRect);
        
        // B. 종단을 따라 배열된 크기 비교용 원들 (남북 종단을 따라 팽창하는 상태 체감 - 반경 500km로 수정)
        const r = 4.4966;
        const latitudes = [-70, -45, -20, 0, 20, 45, 70];
        latitudes.forEach((lat, idx) => {
            const circleGen = d3.geoCircle().center([0, lat]).radius(r);
            shapes.push({
                type: "Feature",
                geometry: circleGen(),
                properties: { label: `종단 원 (${lat}°)`, id: `circle-meridian-${idx}` }
            });
        });
        
        focusedShape = meridianRect; // 남북 종단 사각형을 포커스 분석 대상으로 지정
        
    } else if (state.activeTemplate === 'user-draw') {
        // 7. 사용자 직접 그리기 모드
        if (state.userPolygonPoints.length >= 3) {
            // 다각형이 성립하는 경우 (닫힘)
            const pts = [...state.userPolygonPoints];
            // 닫힌 루프 구성
            if (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) {
                pts.push(pts[0]);
            }
            const userPoly = {
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [pts]
                },
                properties: { label: "사용자 다각형", id: "user" }
            };
            shapes.push(userPoly);
            focusedShape = userPoly;
        } else {
            // 점이 1개나 2개인 경우 선 형태로 임시 렌더링
            renderDrawingGuide();
        }
    }

    // 템플릿 변경 시 혹은 초기 렌더링 시 현재 템플릿에 맞추어 selectedShapeId 기본 설정
    if (focusedShape && (!state.selectedShapeId || !shapes.some(s => s.properties.id === state.selectedShapeId))) {
        state.selectedShapeId = focusedShape.properties.id;
    }

    // 지구본 도형 바인딩 (클릭 시 선택 하이라이트 연동)
    globeShapesLayer.selectAll("path")
        .data(shapes)
        .enter().append("path")
        .attr("class", classMapper)
        .attr("d", globePath)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            event.stopPropagation();
            selectShape(d);
        });

    // 평면 지도 도형 바인딩 (클릭 시 선택 하이라이트 연동)
    mapShapesLayer.selectAll("path")
        .data(shapes)
        .enter().append("path")
        .attr("class", classMapper)
        .attr("d", mapPath)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
            event.stopPropagation();
            selectShape(d);
        });

    // 현재 클릭으로 선택된 도형 객체를 찾아서 왜곡 분석 데이터로 전달
    const currentSelected = shapes.find(s => s.properties.id === state.selectedShapeId) || focusedShape;
    calculateDistortion(currentSelected);
}

// 도형 렌더링 클래스 매퍼 헬퍼 함수 (선택된 도형에 selected-shape 클래스 부여)
function classMapper(d) {
    let baseClass = "geo-poly";
    if (!d || !d.properties) return baseClass;
    const id = d.properties.id;
    if (!id) return baseClass;

    if (id.startsWith('circle')) baseClass = "geo-circle-filled";
    else if (id.startsWith('tissot')) baseClass = "geo-circle";
    else if (id === 'greenland' || id === 'africa') baseClass = "geo-circle-filled";
    else if (id.startsWith('rect')) baseClass = "geo-rect";
    else if (id.startsWith('poly') || id === 'bermuda') baseClass = "geo-poly";
    
    // 만약 선택된 도형이면 하이라이트 클래스 덧붙임
    if (state.selectedShapeId && id === state.selectedShapeId) {
        baseClass += " selected-shape";
    }
    return baseClass;
}

// 도형 클릭 선택 처리 함수 (양방향 동일한 스타일 갱신 및 정보창 업데이트)
function selectShape(feature) {
    if (!feature || !feature.properties) return;
    state.selectedShapeId = feature.properties.id;
    
    // 3D와 2D 레이어의 모든 도형 클래스를 실시간 재적용하여 하이라이트 스타일 업데이트
    globeShapesLayer.selectAll("path").attr("class", classMapper);
    mapShapesLayer.selectAll("path").attr("class", classMapper);
    
    // 우측 상세 정보 수치 및 해설을 선택한 도형으로 업데이트
    calculateDistortion(feature);
}

// 촘촘한 위경도 격자 세그먼트로 보간된 구면 사각형 생성기 (메르카토르 등에서 직선 격자로 투영되도록 만듦)
function createInterpolatedRect(minLon, maxLon, minLat, maxLat, label, id) {
    const coords = [];
    const step = 0.5; // 0.5도 격자 단위로 매우 촘촘하게 분할
    
    // 1. 좌측 경계선 (위로 이동): 경도 minLon 고정, 위도 minLat -> maxLat
    for (let lat = minLat; lat <= maxLat; lat += step) {
        coords.push([minLon, lat]);
    }
    if (coords[coords.length - 1][1] !== maxLat) coords.push([minLon, maxLat]);
    
    // 2. 위쪽 경계선 (우측 이동): 위도 maxLat 고정, 경도 minLon -> maxLon
    for (let lon = minLon; lon <= maxLon; lon += step) {
        coords.push([lon, maxLat]);
    }
    if (coords[coords.length - 1][0] !== maxLon) coords.push([maxLon, maxLat]);
    
    // 3. 우측 경계선 (아래 이동): 경도 maxLon 고정, 위도 maxLat -> minLat
    for (let lat = maxLat; lat >= minLat; lat -= step) {
        coords.push([maxLon, lat]);
    }
    if (coords[coords.length - 1][1] !== minLat) coords.push([maxLon, minLat]);
    
    // 4. 아래쪽 경계선 (좌측 이동): 위도 minLat 고정, 경도 maxLon -> minLon
    for (let lon = maxLon; lon >= minLon; lon -= step) {
        coords.push([lon, minLat]);
    }
    if (coords[coords.length - 1][0] !== minLon) coords.push([minLon, minLat]);
    
    return {
        type: "Feature",
        geometry: {
            type: "Polygon",
            coordinates: [coords]
        },
        properties: { label: label, id: id }
    };
}

// 그리기 진행 상태 가이드라인 렌더링
function renderDrawingGuide() {
    globeDrawLayer.selectAll("*").remove();
    mapDrawLayer.selectAll("*").remove();

    if (state.userPolygonPoints.length === 0) return;

    const activeProj = mapProjections[state.projectionName];

    // 지구본 좌표 가이드 선
    const lineFeature = {
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: state.userPolygonPoints
        }
    };

    globeDrawLayer.append("path")
        .datum(lineFeature)
        .attr("class", "drawing-line")
        .attr("d", globePath);

    mapDrawLayer.append("path")
        .datum(lineFeature)
        .attr("class", "drawing-line")
        .attr("d", mapPath);

    // 점 렌더링
    state.userPolygonPoints.forEach((pt) => {
        const globePt = globeProjection(pt);
        // 지구본 투영의 경우 화면 뒤로 넘어간 점은 숨김처리해야함.
        // d3.geoClipAntimeridian 등에 의해 뒤쪽 점은 d3.geoPath에서 보이지 않지만 수동 점 그리기는 뒤쪽 클리핑 판단 필요
        // 간단하게 지구본 중심으로부터의 구면거리(Great Circle Distance)가 90도 이하인 경우에만 렌더링
        const distance = d3.geoDistance(globeProjection.invert([globeWidth/2, globeHeight/2]), pt);
        if (distance <= Math.PI / 2 && globePt) {
            globeDrawLayer.append("circle")
                .attr("cx", globePt[0])
                .attr("cy", globePt[1])
                .attr("r", 4)
                .attr("class", "drawing-point");
        }

        const mapPt = activeProj(pt);
        if (mapPt) {
            mapDrawLayer.append("circle")
                .attr("cx", mapPt[0])
                .attr("cy", mapPt[1])
                .attr("r", 4)
                .attr("class", "drawing-point");
        }
    });
}

// 10. 도형 왜곡 연산 알고리즘 (신발끈 공식 및 구면 면적 비교)
function calculateDistortion(feature) {
    // 도형이나 지오메트리가 유효하지 않은 경우 안전하게 초기화 후 조기 리턴 (TypeError 방지)
    if (!feature || !feature.geometry || !feature.geometry.type || !feature.geometry.coordinates) {
        d3.select("#geom-real-area").text("0 km²");
        d3.select("#dash-geom-real-area").text("0 km²");
        
        d3.select("#geom-map-area").text("0 px²");
        d3.select("#dash-geom-map-area").text("0 px²");
        
        d3.select("#geom-area-ratio").text("1.00배");
        d3.select("#dash-geom-area-ratio").text("1.00배");
        
        d3.select("#geom-distortion").text("0.00%");
        d3.select("#dash-geom-distortion").text("0.00%");
        
        const initDesc = "템플릿을 선택하거나 지도를 클릭하여 도형을 그려보세요. 구면상의 면적 대비 지도 평면에 투영된 면적 왜곡 수치가 실시간 계산됩니다.";
        d3.select("#distortion-detailed-desc").text(initDesc);
        d3.select("#dash-distortion-detailed-desc").text(initDesc);
        return;
    }

    try {
        // A. 구면 실제 면적 계산 (D3 Winding Order 및 구면 기하 오차 방지 보완 공식 적용)
        let realAreaKm2 = 0;
        const id = (feature.properties && feature.properties.id) ? feature.properties.id : "";
        
        if (id.startsWith('circle') || id === 'greenland' || id === 'africa' || id.startsWith('tissot')) {
            // 1. 구면 원 지오메트리 면적 수학 공식: S = 2 * PI * R^2 * (1 - cos(theta))
            let rDeg = 4.4966; // 템플릿 원들은 물리 반지름 500km(4.4966도)로 일괄 고정
            if (id.startsWith('tissot')) {
                rDeg = state.tissotSize; // 팃소 지시타원은 슬라이더 크기에 비례
            }
            
            const theta = rDeg * Math.PI / 180;
            realAreaKm2 = 2 * Math.PI * 6371 * 6371 * (1 - Math.cos(theta));
        } else if (id.startsWith('rect') && feature.geometry && feature.geometry.coordinates) {
            // 2. 구면 사각형 지오메트리 면적 수학 공식: S = R^2 * delta_lon_rad * |sin(lat2) - sin(lat1)|
            const coords = feature.geometry.coordinates[0];
            const lons = coords.map(p => p[0]);
            const lats = coords.map(p => p[1]);
            const minLon = Math.min(...lons), maxLon = Math.max(...lons);
            const minY = Math.min(...lats), maxY = Math.max(...lats);
            
            const deltaLonRad = (maxLon - minLon) * Math.PI / 180;
            const sinLat2 = Math.sin(maxY * Math.PI / 180);
            const sinLat1 = Math.sin(minY * Math.PI / 180);
            
            realAreaKm2 = 6371 * 6371 * deltaLonRad * Math.abs(sinLat2 - sinLat1);
        } else {
            // 3. 다각형 및 사용자 커스텀 그리기: d3.geoArea 연산 시도 및 실패 시 위도 보정 신발끈 적분
            let sphereAreaRad = 0;
            try {
                sphereAreaRad = d3.geoArea(feature.geometry || feature);
            } catch (e) {
                sphereAreaRad = 0;
            }
            if (sphereAreaRad > Math.PI * 2) {
                sphereAreaRad = Math.PI * 4 - sphereAreaRad;
            }
            realAreaKm2 = sphereAreaRad * 6371 * 6371;
            
            // 만약 d3.geoArea 결과가 유효하지 않거나 너무 작으면 (꼬임 오류 등), 평면 위도 보정 캘리브레이션 공식으로 복원
            if ((realAreaKm2 < 1 || isNaN(realAreaKm2)) && feature.geometry && feature.geometry.coordinates) {
                const coords = feature.geometry.coordinates[0];
                let degArea = 0;
                if (coords.length >= 3) {
                    let j = coords.length - 1;
                    for (let i = 0; i < coords.length; i++) {
                        degArea += (coords[j][0] + coords[i][0]) * (coords[j][1] - coords[i][1]);
                        j = i;
                    }
                    degArea = Math.abs(degArea / 2);
                    
                    const centroid = d3.geoCentroid(feature);
                    const latRad = Math.abs(centroid[1] * Math.PI / 180);
                    // 1도 격자의 위도별 면적: 111.32km * 111.32km * cos(lat)
                    const km2PerDeg2 = 111.32 * 111.32 * Math.cos(latRad);
                    realAreaKm2 = degArea * km2PerDeg2;
                }
            }
        }

        // B. 평면 지도 상의 투영 픽셀 좌표 계산 및 픽셀 면적 계산
        const activeProj = mapProjections[state.projectionName];
        
        // GeoJSON의 첫 번째 링 좌표 추출
        let coords = [];
        if (feature.geometry.type === "Polygon") {
            coords = feature.geometry.coordinates[0];
        } else if (feature.geometry.type === "MultiPolygon") {
            coords = feature.geometry.coordinates[0][0];
        }

    // 픽셀 좌표 변환
    const pixelCoords = coords.map(pt => activeProj(pt)).filter(pt => pt !== null);

    // 신발끈 공식으로 평면 픽셀 면적 계산
    let pxArea = 0;
    if (pixelCoords.length >= 3) {
        let j = pixelCoords.length - 1;
        for (let i = 0; i < pixelCoords.length; i++) {
            pxArea += (pixelCoords[j][0] + pixelCoords[i][0]) * (pixelCoords[j][1] - pixelCoords[i][1]);
            j = i;
        }
        pxArea = Math.abs(pxArea / 2);
    }

    // C. 면적 왜곡 배율 (평면 픽셀 면적 / 구면 실제 면적)
    // 단위 보정을 위해, 적도 상에 위치한 가상의 표준 원을 기준으로 삼습니다.
    // 적도 [0,0]에 반경 1도 원을 그리고, 해당 도법에서 이 원이 몇 px²을 가지는지를 스케일 기준으로 사용합니다.
    const refRadius = 1; // 1도 원
    const refCircle = d3.geoCircle().center([0, 0]).radius(refRadius)();
    const refSphereArea = d3.geoArea(refCircle) * 6371 * 6371;
    const refCoords = refCircle.geometry ? refCircle.geometry.coordinates[0] : refCircle.coordinates[0];
    const refPixelCoords = refCoords.map(pt => activeProj(pt)).filter(pt => pt !== null);
    let refPxArea = 0;
    if (refPixelCoords.length >= 3) {
        let j = refPixelCoords.length - 1;
        for (let i = 0; i < refPixelCoords.length; i++) {
            refPxArea += (refPixelCoords[j][0] + refPixelCoords[i][0]) * (refPixelCoords[j][1] - refPixelCoords[i][1]);
            j = i;
        }
        refPxArea = Math.abs(refPxArea / 2);
    }
    
    // 스케일 기준값 C = refPxArea / refSphereArea
    const scaleFactor = refPxArea / refSphereArea;
    let areaRatio = 1.00;
    if (scaleFactor > 0 && realAreaKm2 > 0) {
        areaRatio = (pxArea / realAreaKm2) / scaleFactor;
    }

    // D. 형태 왜곡도 (종횡비 편차 계산)
    // 투영된 픽셀 좌표들 중 X축 범위와 Y축 범위의 편차를 계산
    let shapeDistortion = 0;
    if (pixelCoords.length >= 3) {
        const xs = pixelCoords.map(p => p[0]);
        const ys = pixelCoords.map(p => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const width = maxX - minX;
        const height = maxY - minY;
        
        if (width > 0 && height > 0) {
            // 등각도법(메르카토르)의 완벽한 둥근 모양 대비, 한쪽으로 늘어난 정도를 백분율화
            // 원형 템플릿의 경우 종횡비가 1:1이어야 하므로, 1에서의 편차 계산
            // 다각형(버뮤다 등)은 자체 형태가 원래 길쭉하므로, 투영 시 각도 찌그러짐을 정확히 수학적으로 연산하는 것이 좋음.
            // 여기서는 구면 상에서 생성된 완벽한 원을 활용할 때 왜곡 지표의 신뢰도가 가장 높습니다.
            const ratio = Math.max(width / height, height / width);
            shapeDistortion = (ratio - 1) * 100;
            
            // 만약 메르카토르 도법이면, 등각성이 유지되므로 형태 왜곡도가 이론적으로 0%여야 함.
            // 위경도 격자 격차로 인한 수치 오차를 보정 (메르카토르에서는 항상 정원으로 렌더링되므로 0으로 보정)
            if (state.projectionName === 'mercator' && feature.properties.id !== 'bermuda') {
                shapeDistortion = 0.0;
            }
        }
    }

    // UI 값 표출 (1000 미만의 극소 면적에 대해 소수점 둘째자리 정밀 포맷 제공)
    let realAreaStr = "0 km²";
    if (realAreaKm2 > 0) {
        realAreaStr = realAreaKm2 < 1000 ? `${realAreaKm2.toFixed(2)} km²` : `${Math.round(realAreaKm2).toLocaleString()} km²`;
    }
    
    // 2D 줌 스케일이 적용된 겉보기 픽셀 면적 계산 (화면상 시각적 점유 픽셀 크기 반영)
    const visiblePxArea = pxArea * state.zoomScale * state.zoomScale;
    
    let pxAreaStr = "0 px²";
    if (visiblePxArea > 0) {
        pxAreaStr = visiblePxArea < 1000 ? `${visiblePxArea.toFixed(2)} px²` : `${Math.round(visiblePxArea).toLocaleString()} px²`;
    }

    d3.select("#geom-real-area").text(realAreaStr);
    d3.select("#dash-geom-real-area").text(realAreaStr);
    
    d3.select("#geom-map-area").text(pxAreaStr);
    d3.select("#dash-geom-map-area").text(pxAreaStr);
    
    if (areaRatio === Infinity || isNaN(areaRatio) || areaRatio > 1000) {
        d3.select("#geom-area-ratio").text("측정 불가 (∞)");
        d3.select("#dash-geom-area-ratio").text("측정 불가 (∞)");
    } else {
        d3.select("#geom-area-ratio").text(`${areaRatio.toFixed(2)}배`);
        d3.select("#dash-geom-area-ratio").text(`${areaRatio.toFixed(2)}배`);
    }
    
    d3.select("#geom-distortion").text(`${shapeDistortion.toFixed(2)}%`);
    d3.select("#dash-geom-distortion").text(`${shapeDistortion.toFixed(2)}%`);

    // 수치에 근거한 동적 해설 문구 작성
    let detailedDesc = "";
    const labelName = feature.properties.label || "선택한 도형";
    
    if (state.activeTemplate === 'equator-circles') {
        detailedDesc = `<strong>'${labelName}' 분석 결과:</strong> 구면상에서 반지름이 동일한 3개의 원 중 하나를 분석한 결과입니다. `;
        if (state.projectionName === 'mercator') {
            detailedDesc += `메르카토르 도법에서는 위도가 상승할수록 형태 왜곡은 0%로 보존되어 완벽한 원 모양을 유지하지만, 면적 왜곡 배율이 기하급수적으로 폭증합니다. 현재 고위도의 원은 적도 대비 면적이 <strong>${areaRatio.toFixed(1)}배</strong> 부풀려져 있습니다.`;
        } else if (state.projectionName === 'mollweide') {
            detailedDesc += `몰바이데 도법은 등적 도법으로, 고위도에서도 면적 왜곡 배율은 항상 <strong>1.00배</strong>(0% 왜곡)로 보존됩니다. 대신 형태 왜곡도가 <strong>${shapeDistortion.toFixed(1)}%</strong>로 치솟아, 고위도 원이 가로세로로 길쭉하게 찌그러진 타원으로 투영된 것을 볼 수 있습니다.`;
        } else if (state.projectionName === 'equirectangular') {
            detailedDesc += `정거원통 도법은 고위도로 갈수록 위도선이 펴지며 가로로 넓어져 면적 왜곡(<strong>${areaRatio.toFixed(1)}배</strong>)과 형태 찌그러짐(<strong>${shapeDistortion.toFixed(1)}%</strong>)이 동시에 발생합니다.`;
        } else {
            detailedDesc += `현재 선택된 도법에 의해 면적은 <strong>${areaRatio.toFixed(2)}배</strong> 왜곡되었고, 형태는 <strong>${shapeDistortion.toFixed(1)}%</strong> 만큼 찌그러졌습니다.`;
        }
    } else if (state.activeTemplate === 'greenland-africa') {
        detailedDesc = `<strong>'그린란드 vs 아프리카' 원형 면적 비교:</strong> 실제 그린란드는 아프리카의 약 1/14 크기에 불과합니다. 적도 아프리카와 고위도 그린란드에 동일한 크기(구면반경 10도)의 디스크를 얹어 크기를 투영해보았습니다. `;
        if (state.projectionName === 'mercator') {
            detailedDesc += `메르카토르 도법에서는 그린란드 비교원이 적도 아프리카원보다 <strong>${(areaRatio).toFixed(1)}배</strong> 거대하게 표출되어 시각적으로 아프리카보다 더 넓어 보이는 면적 역전 왜곡을 일으킵니다.`;
        } else if (state.projectionName === 'mollweide') {
            detailedDesc += `몰바이데 도법은 두 원의 면적 왜곡이 모두 1.00배로 정확하게 유지됩니다. 아프리카원과 그린란드원의 면적이 시각적으로 완전히 동일하게 투영되지만, 그린란드는 극지 찌그러짐 현상으로 타원형이 된 것을 알 수 있습니다.`;
        } else {
            detailedDesc += `현재 도법에서 고위도 그린란드원의 면적 왜곡률은 적도 대비 <strong>${areaRatio.toFixed(2)}배</strong>로 나타납니다.`;
        }
    } else if (state.activeTemplate === 'bermuda-triangle') {
        detailedDesc = `<strong>'${labelName}' 분석 결과:</strong> 위도대별(적도, 중위도, 고위도) 및 꼭짓점 수(3각~10각)에 따라 행렬 그리드로 나열된 다각형 중 하나를 분석한 결과입니다. `;
        if (state.projectionName === 'mercator') {
            detailedDesc += `메르카토르 도법 상에서 다각형들은 등각성 덕분에 고유의 외각 각도는 완벽하게 유지되지만, 위도가 상승할수록 면적이 무한정 확대됩니다. 현재 선택한 다각형은 적도 대비 면적이 <strong>${areaRatio.toFixed(2)}배</strong> 거대해졌습니다. 꼭짓점 수(3~10각)가 늘어남에 따라 정다각형이 서서히 원에 수렴해 가는 기하학적 수렴성을 함께 확인할 수 있습니다.`;
        } else if (state.projectionName === 'mollweide') {
            detailedDesc += `몰바이데 등적도법은 면적이 1.00배로 정확하게 유지되지만, 중심 경위도의 곡률 영향에 따라 다각형의 형태가 <strong>${shapeDistortion.toFixed(1)}%</strong> 찌그러져 럭비공처럼 좌우로 길쭉한 형상이 됩니다.`;
        } else {
            detailedDesc += `현재 선택된 도법에 의해 면적은 <strong>${areaRatio.toFixed(2)}배</strong> 왜곡되었으며, 형태 찌그러짐은 <strong>${shapeDistortion.toFixed(1)}%</strong>로 렌더링되고 있습니다.`;
        }
    } else if (state.activeTemplate === 'rectangles') {
        detailedDesc = `<strong>'${labelName}' 분석 결과:</strong> 구면상에서 동일한 한 변 1000km 정사각형 크기를 갖는 적도, 중위도, 고위도의 사각형 영역을 대조 투영한 결과입니다. `;
        if (state.projectionName === 'mercator') {
            detailedDesc += `메르카토르 도법에서 사각형들은 형태 왜곡이 전혀 없어 여전히 직사각형 모양을 유지하지만, 고위도의 사각형은 세로 격자 크기가 극적으로 확장되어 적도 대비 <strong>${areaRatio.toFixed(1)}배</strong> 비대해진 것을 관찰할 수 있습니다.`;
        } else if (state.projectionName === 'mollweide') {
            detailedDesc += `몰바이데 등적도법은 면적이 항상 1.00배(0% 왜곡)로 완전 보존됩니다. 세 사각형의 실제 면적은 같지만, 위도가 높아질수록 경도선 수렴으로 인해 부채꼴/사다리꼴 형태로 <strong>${shapeDistortion.toFixed(1)}%</strong> 찌그러집니다.`;
        } else {
            detailedDesc += `현재 선택된 도법에 의해 면적은 <strong>${areaRatio.toFixed(2)}배</strong> 왜곡되었으며, 형태는 <strong>${shapeDistortion.toFixed(1)}%</strong> 만큼 변형되었습니다.`;
        }
    } else if (state.activeTemplate === 'equator-straddle') {
        detailedDesc = `<strong>'${labelName}' 분석 결과:</strong> 적도선을 기준으로 북위와 남위로 걸쳐져 있는 도형들을 투영한 결과입니다. `;
        if (state.projectionName === 'mercator') {
            detailedDesc += `메르카토르 도법 상에서 적도선 부근은 면적과 형태 왜곡이 거의 발생하지 않는 가장 온전한 지역입니다. 적도에 정확히 절반씩 걸쳐진 원(1.00배 왜곡), 사각형, 다각형은 좌우대칭과 상하대칭이 완벽히 보존된 깨끗한 형태로 투영됩니다.`;
        } else if (state.projectionName === 'mollweide') {
            detailedDesc += `몰바이데 등적도법에서도 면적은 1.00배로 보존되지만, 좌우 외각 경위도망의 경사에 영향을 받는 사각형(경도 -35도 부근)과 다각형(경도 35도 부근)은 적도를 가로지르면서도 사선 형태로 미세하게 기울어지고 찌그러지는 현상이 발생합니다.`;
        } else {
            detailedDesc += `적도에 걸침으로써 위도대별 왜곡 평행성이 대칭적으로 작용하여, 면적은 <strong>${areaRatio.toFixed(2)}배</strong> 수준에서 찌그러짐 <strong>${shapeDistortion.toFixed(1)}%</strong>으로 렌더링됩니다.`;
        }
    } else if (state.activeTemplate === 'meridian-strip') {
        detailedDesc = `<strong>'${labelName}' 분석 결과:</strong> 남위 80°부터 북위 80°까지 자오선을 따라 남북으로 길게 뻗은 기둥 모양의 거대 사각형 영역을 분석했습니다. `;
        if (state.projectionName === 'mercator') {
            detailedDesc += `메르카토르 도법 상에서 이 종단 기둥은 고위도로 가면서 가로세로 폭이 모두 팽창하여, 실제로는 일정한 자오선 폭임에도 불구하고 극지로 갈수록 거대한 나팔관처럼 팽창하는 띠가 됩니다. 기둥의 평균 면적 왜곡률은 무려 <strong>${areaRatio.toFixed(1)}배</strong>로 치솟습니다. 자오선 상에 나열된 원형군 역시 적도(0°) 대비 고위도(±70°)로 갈수록 거대하게 부풀어 오르는 현상을 생생히 볼 수 있습니다.`;
        } else if (state.projectionName === 'mollweide') {
            detailedDesc += `몰바이데 도법 상에서 이 종단 띠의 총 면적 왜곡 배율은 <strong>1.00배</strong>(0% 왜곡)로 온전히 보존됩니다. 대신, 경도선이 북극과 남극점으로 수렴함에 따라 기둥의 위아래가 급격하게 오므라들어 뾰족하고 둥근 럭비공 같은 모양이 됩니다. 원형군들도 극지로 가며 위아래가 극단적으로 찌그러진 타원으로 변합니다.`;
        } else {
            detailedDesc += `남북 종단 띠의 면적 왜곡 배율은 평균 <strong>${areaRatio.toFixed(2)}배</strong>로 나타나며, 형태 왜곡도는 평균 <strong>${shapeDistortion.toFixed(1)}%</strong>로 산출되었습니다.`;
        }
    } else if (state.activeTemplate === 'user-draw') {
        detailedDesc = `<strong>사용자 정의 다각형 분석:</strong> 화면을 마우스 클릭하여 구면에 그린 다각형입니다. `;
        detailedDesc += `이 영역은 실제 구면상에서 약 <strong>${Math.round(realAreaKm2).toLocaleString()} km²</strong>의 면적을 가지며, 현재 도법의 투영 왜곡으로 인해 평면상에서는 기준율 대비 <strong>${areaRatio.toFixed(2)}배</strong>의 크기로 확대/축소되어 있고, 형태는 <strong>${shapeDistortion.toFixed(1)}%</strong> 왜곡되었습니다.`;
    }

    d3.select("#distortion-detailed-desc").html(detailedDesc);
    d3.select("#dash-distortion-detailed-desc").html(detailedDesc);
    } catch (err) {
        console.error("Distortion error:", err);
    }
}

// 11. 인터랙션 바인딩 및 이벤트 리스너 설정
function setupInteractions() {
    // 2D 평면지도 줌 및 패닝 동작 정의 (D3 Zoom)
    // 3D와 2D의 확대정도 및 중심점을 1:1로 항상 동일하게 유지하는 마우스 휠 줌 기능 구현
    const minZoom = 1.0;
    const maxZoom = 8.0;
    const handleWheelZoom = (event) => {
        event.preventDefault(); // 브라우저 전체 스크롤 방지
        const direction = event.deltaY < 0 ? 1 : -1;
        const zoomStep = 0.2;
        
        // 공통 줌 스케일 값 갱신 (1배율 ~ 8배율)
        state.zoomScale = Math.max(minZoom, Math.min(maxZoom, state.zoomScale + direction * zoomStep));
        
        // 지구본 투영 스케일 및 물리 구체 크기 동시 연동
        const baseGlobeScale = 150 * state.zoomScale;
        globeProjection.scale(baseGlobeScale);
        globeOcean.attr("r", baseGlobeScale);
        globeGlow.attr("r", baseGlobeScale);
        globeOutline.attr("r", baseGlobeScale);
        
        // 2D 지도는 updateViews() 내에서 정중앙 기준으로 k=zoomScale 변환되므로 자동 일치됩니다.
        updateViews();
    };

    // 양쪽 지도 컨테이너에 공통 휠 이벤트 바인딩
    d3.select("#globe-container").on("wheel", handleWheelZoom);
    d3.select("#map-container").on("wheel", handleWheelZoom);

    // A. 3D 지구본 드래그 회전 구현
    const dragGlobe = d3.drag()
        .on("start", () => {
            d3.select(".instructions-overlay").style("opacity", 0); // 회전 시작 시 팁 숨김
        })
        .on("drag", (event) => {
            // 드래그 속도(민감도) 조절
            const k = 70 / globeProjection.scale();
            const r = globeProjection.rotate();
            
            // 드래그 움직임을 구면 좌표 회전값으로 변환 (좌우 경도 회전만 허용)
            state.rotation = [
                r[0] + event.dx * k,
                0,
                0
            ];
            
            updateViews();
        });

    globeSvg.call(dragGlobe);

    // B. 2D 평면지도 드래그 회전 구현 (양방향 연동 - 좌우 회전만 허용)
    const dragMap = d3.drag()
        .on("drag", (event) => {
            const activeProj = mapProjections[state.projectionName];
            const k = 50 / activeProj.scale();
            const r = activeProj.rotate();
            
            // 마우스 움직임을 반영하여 평면지도의 투영중심 회전
            state.rotation = [
                r[0] + event.dx * k,
                0,
                0
            ];
            
            updateViews();
        });

    mapSvg.call(dragMap);

    // C. 2D 평면지도 클릭 시 커스텀 다각형 점 찍기 구현 (직접 그리기 모드 전용)
    mapSvg.on("click", (event) => {
        if (state.simulationMode !== 'shapes' || state.activeTemplate !== 'user-draw') return;
        
        // 클릭 좌표 얻기 (현재 줌 스케일 및 중앙 정렬 패닝 역산 보정 적용)
        const coords = d3.pointer(event);
        const k = state.zoomScale;
        const tx = (mapWidth / 2) * (1 - k);
        const ty = (mapHeight / 2) * (1 - k);
        
        // 줌 트랜스폼이 입혀지기 이전의 원본 픽셀 스케일 상의 좌표로 변환
        const correctedCoords = [
            (coords[0] - tx) / k,
            (coords[1] - ty) / k
        ];
        
        const activeProj = mapProjections[state.projectionName];
        
        // 보정된 픽셀 좌표를 위경도 좌표로 역투영 (Invert)
        const geoPt = activeProj.invert(correctedCoords);
        
        // 투영 범위 밖을 클릭한 경우 null 방지
        if (geoPt && !isNaN(geoPt[0]) && !isNaN(geoPt[1])) {
            state.userPolygonPoints.push(geoPt);
            renderCustomShapes();
        }
    });

    // 3D 지구본 클릭 시 점 찍기 지원 (3D 드래그와 클릭 충돌을 방지하기 위해 마우스 다운 시점과 클릭 종료 시점을 대조)
    let isDragging = false;
    globeSvg
        .on("mousedown", () => { isDragging = false; })
        .on("mousemove", () => { isDragging = true; })
        .on("click", (event) => {
            if (isDragging) return; // 드래그 회전인 경우 클릭 무시
            if (state.simulationMode !== 'shapes' || state.activeTemplate !== 'user-draw') return;
            
            const coords = d3.pointer(event);
            // 오르토그래픽 역투영
            const geoPt = globeProjection.invert(coords);
            
            if (geoPt && !isNaN(geoPt[0]) && !isNaN(geoPt[1])) {
                // 클릭한 좌표가 구체 안쪽 영역인지 확인 (역투영이 유효한지)
                const distance = d3.geoDistance(globeProjection.invert([globeWidth/2, globeHeight/2]), geoPt);
                if (distance <= Math.PI / 2) {
                    state.userPolygonPoints.push(geoPt);
                    renderCustomShapes();
                }
            }
        });

    // D. 탭 전환 제어
    d3.selectAll(".tab-btn").on("click", function() {
        const tabId = d3.select(this).attr("data-tab");
        
        d3.selectAll(".tab-btn").classed("active", false);
        d3.select(this).classed("active", true);
        
        d3.selectAll(".tab-content").classed("active", false);
        d3.select(`#tab-${tabId}`).classed("active", true);
    });

    // E. 도법 선택 드롭다운 리스너
    d3.select("#projection-select").on("change", function() {
        state.projectionName = this.value;
        
        // 서브타이틀 및 우측 학습 데이터 업데이트
        const details = PROJECTION_DETAILS[state.projectionName];
        d3.select("#projection-subtitle").text(details.type);
        
        // 학습 패널 텍스트 교체
        d3.select("#info-proj-name").text(details.name);
        d3.select("#info-proj-type").text(details.type);
        d3.select("#info-proj-distort").text(details.distortion);
        d3.select("#info-proj-desc").text(details.desc);
        d3.select("#info-proj-usages").text(details.usages);
        
        // 수치 게이지 바 업데이트
        d3.select("#metric-area-bar").style("width", `${details.areaDistortionValue}%`);
        d3.select("#metric-area-value").text(details.areaText);
        d3.select("#metric-shape-bar").style("width", `${details.shapeDistortionValue}%`);
        d3.select("#metric-shape-value").text(details.shapeText);

        updateViews();
    });

    // F. 시뮬레이터 모드 스위칭
    d3.select("#btn-mode-tissot").on("click", function() {
        state.simulationMode = 'tissot';
        d3.selectAll(".btn-mode").classed("active", false);
        d3.select(this).classed("active", true);
        
        d3.select("#tissot-controls").classed("hidden", false);
        d3.select("#shapes-controls").classed("hidden", true);
        d3.select("#mode-help-text").html("**팃소의 지시타원(Tissot's Indicatrix)**: 지구 전역에 가상의 같은 크기 원들을 그린 후, 도법에 따라 이 원들이 어떻게 타원으로 찌그러지고 확대되는지 관찰합니다.");
        
        // 하단 범례 동기화
        syncLegendWithMode('tissot');
        updateViews();
    });

    d3.select("#btn-mode-shapes").on("click", function() {
        state.simulationMode = 'shapes';
        d3.selectAll(".btn-mode").classed("active", false);
        d3.select(this).classed("active", true);
        
        d3.select("#tissot-controls").classed("hidden", true);
        d3.select("#shapes-controls").classed("hidden", false);
        d3.select("#mode-help-text").html("**도형 비교 시뮬레이터**: 원형 템플릿 또는 다각형 경로가 도법을 거쳤을 때의 실제 찌그러짐 현상을 픽셀단위로 계측하고 수치를 분석합니다.");
        
        // 하단 범례 동기화
        syncLegendWithMode('shapes');
        updateViews();
    });

    // G-2. 전역 글꼴 크기 증감 조절 리스너 (+/- 버튼형)
    let currentFontSize = 16;
    const MIN_FONT_SIZE = 12;
    const MAX_FONT_SIZE = 22;

    function applyFontSize(size) {
        currentFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
        d3.select("html").style("font-size", `${currentFontSize}px`);
        d3.select("#font-size-val").text(`${currentFontSize}px`);
        
        // 버튼 불투명도를 이용한 비활성 한계 상태 표시
        d3.select("#btn-font-decrease")
            .style("opacity", currentFontSize === MIN_FONT_SIZE ? "0.35" : "1.0")
            .style("pointer-events", currentFontSize === MIN_FONT_SIZE ? "none" : "auto");
        d3.select("#btn-font-increase")
            .style("opacity", currentFontSize === MAX_FONT_SIZE ? "0.35" : "1.0")
            .style("pointer-events", currentFontSize === MAX_FONT_SIZE ? "none" : "auto");
    }

    d3.select("#btn-font-decrease").on("click", () => {
        applyFontSize(currentFontSize - 1);
    });

    d3.select("#btn-font-increase").on("click", () => {
        applyFontSize(currentFontSize + 1);
    });
    
    // 최초 실행 적용
    applyFontSize(currentFontSize);

    // G. 팃소 지시타원 조절 슬라이더 리스너
    d3.select("#tissot-size-slider").on("input", function() {
        state.tissotSize = +this.value;
        // 구면거리 공식 d = 6371 * (theta * PI / 180) 환산
        const kmVal = Math.round(6371 * (state.tissotSize * Math.PI / 180));
        d3.select("#tissot-size-val").text(`${state.tissotSize}° (약 ${kmVal}km)`);
        if (state.simulationMode === 'tissot') renderTissot();
    });

    d3.select("#tissot-density-slider").on("input", function() {
        state.tissotDensity = +this.value;
        d3.select("#tissot-density-val").text(`${state.tissotDensity}°`);
        if (state.simulationMode === 'tissot') renderTissot();
    });

    // H. 도형 템플릿 변경 리스너
    d3.selectAll(".btn-template").on("click", function() {
        const templateId = d3.select(this).attr("data-template");
        
        d3.selectAll(".btn-template").classed("active", false);
        d3.select(this).classed("active", true);
        
        state.activeTemplate = templateId;
        
        // 직접 그리기 모드 시 안내문구 표출
        if (templateId === 'user-draw') {
            d3.select("#draw-instructions").classed("hidden", false);
            // 그리기 모드 초기화
            state.userPolygonPoints = [];
        } else {
            d3.select("#draw-instructions").classed("hidden", true);
        }
        
        // 하단 범례 동기화
        syncLegendWithTemplate(templateId);
        renderCustomShapes();
    });

    // I. 직접 그리기 모드 액션 버튼
    d3.select("#btn-finish-polygon").on("click", () => {
        if (state.userPolygonPoints.length >= 3) {
            // 도형 닫아서 렌더링
            renderCustomShapes();
        }
    });

    d3.select("#btn-clear-polygon").on("click", () => {
        state.userPolygonPoints = [];
        renderCustomShapes();
    });

    // J. 회전각 및 줌 초기화 버튼 리스너 (부드러운 복원 애니메이션 적용)
    d3.select("#btn-reset-rotation").on("click", () => {
        const startRotation = [...state.rotation];
        const endRotation = [0, 0, 0];
        const startScale = state.zoomScale;
        const endScale = 1.0;
        
        // 이미 초기 상태인 경우 회전/스케일 보간 애니메이션 생략
        if (startRotation[0] === 0 && startRotation[1] === 0 && startRotation[2] === 0 && startScale === 1.0) return;

        d3.transition()
            .duration(1000)
            .ease(d3.easeCubicOut)
            .tween("reset", () => {
                const rotInterpolator = d3.interpolate(startRotation, endRotation);
                const scaleInterpolator = d3.interpolate(startScale, endScale);
                return (t) => {
                    state.rotation = rotInterpolator(t);
                    state.zoomScale = scaleInterpolator(t);
                    
                    // 지구본 및 구 바다/외곽/글로우 크기 복원 동기화
                    const baseGlobeScale = 150 * state.zoomScale;
                    globeProjection.scale(baseGlobeScale);
                    globeOcean.attr("r", baseGlobeScale);
                    globeGlow.attr("r", baseGlobeScale);
                    globeOutline.attr("r", baseGlobeScale);
                    
                    updateViews();
                };
            });
    });

    // K. 하단 범례 버튼 클릭 이벤트 연동 (지도상 표출 객체 제어)
    d3.select("#legend-circle").on("click", function() {
        updateLegendActive(this);
        // 팃소 지시타원 모드로 설정
        state.simulationMode = 'tissot';
        
        // 우측 시뮬레이터 모드 버튼 갱신
        d3.selectAll(".btn-mode").classed("active", false);
        d3.select("#btn-mode-tissot").classed("active", true);
        d3.select("#tissot-controls").classed("hidden", false);
        d3.select("#shapes-controls").classed("hidden", true);
        d3.select("#mode-help-text").html("**팃소의 지시타원(Tissot's Indicatrix)**: 지구 전역에 가상의 같은 크기 원들을 그린 후, 도법에 따라 이 원들이 어떻게 타원으로 찌그러지고 확대되는지 관찰합니다.");
        
        updateViews();
    });

    d3.select("#legend-rect").on("click", function() {
        updateLegendActive(this);
        // 사각형 비교 모드로 설정
        state.simulationMode = 'shapes';
        state.activeTemplate = 'rectangles';
        
        // 우측 패널 제어 요소 동기화
        d3.selectAll(".btn-mode").classed("active", false);
        d3.select("#btn-mode-shapes").classed("active", true);
        d3.select("#tissot-controls").classed("hidden", true);
        d3.select("#shapes-controls").classed("hidden", false);
        d3.select("#mode-help-text").html("**도형 비교 시뮬레이터**: 원형 템플릿 또는 다각형 경로가 도법을 거쳤을 때의 실제 찌그러짐 현상을 픽셀단위로 계측하고 수치를 분석합니다.");
        
        d3.selectAll(".btn-template").classed("active", false);
        d3.select("[data-template='rectangles']").classed("active", true);
        d3.select("#draw-instructions").classed("hidden", true);
        
        updateViews();
    });

    d3.select("#legend-poly").on("click", function() {
        updateLegendActive(this);
        // 다각형(버뮤다 삼각지대) 모드로 설정
        state.simulationMode = 'shapes';
        state.activeTemplate = 'bermuda-triangle';
        
        // 우측 패널 제어 요소 동기화
        d3.selectAll(".btn-mode").classed("active", false);
        d3.select("#btn-mode-shapes").classed("active", true);
        d3.select("#tissot-controls").classed("hidden", true);
        d3.select("#shapes-controls").classed("hidden", false);
        d3.select("#mode-help-text").html("**도형 비교 시뮬레이터**: 원형 템플릿 또는 다각형 경로가 도법을 거쳤을 때의 실제 찌그러짐 현상을 픽셀단위로 계측하고 수치를 분석합니다.");
        
        d3.selectAll(".btn-template").classed("active", false);
        d3.select("[data-template='bermuda-triangle']").classed("active", true);
        d3.select("#draw-instructions").classed("hidden", true);
        
        updateViews();
    });

    // 범례 active 클래스 갱신 헬퍼 함수
    function updateLegendActive(element) {
        d3.selectAll(".legend-item").classed("active", false);
        d3.select(element).classed("active", true);
    }

    // 우측 모드 전환에 따른 하단 범례 동기화 헬퍼
    function syncLegendWithMode(mode) {
        d3.selectAll(".legend-item").classed("active", false);
        if (mode === 'tissot') {
            d3.select("#legend-circle").classed("active", true);
        } else {
            // shapes 모드인 경우 현재 활성화된 템플릿에 연동
            syncLegendWithTemplate(state.activeTemplate);
        }
    }

    // 우측 템플릿 전환에 따른 하단 범례 동기화 헬퍼
    function syncLegendWithTemplate(templateId) {
        d3.selectAll(".legend-item").classed("active", false);
        if (templateId === 'equator-circles' || templateId === 'greenland-africa' || templateId === 'equator-straddle') {
            d3.select("#legend-circle").classed("active", true);
        } else if (templateId === 'rectangles' || templateId === 'meridian-strip') {
            d3.select("#legend-rect").classed("active", true);
        } else if (templateId === 'bermuda-triangle' || templateId === 'user-draw') {
            d3.select("#legend-poly").classed("active", true);
        }
    }

    // L. 인트로 오버레이 화면 제어 리스너
    d3.select("#btn-close-intro").on("click", () => {
        d3.select("#intro-screen").classed("hidden", true);
    });

    d3.select("#btn-show-intro").on("click", () => {
        d3.select("#intro-screen").classed("hidden", false);
    });

    // M. 팃소 지시타원 상세 소개 모달 제어 및 미니 시뮬레이터 구동
    d3.select("#btn-show-tissot-desc").on("click", () => {
        d3.select("#tissot-desc-modal").classed("hidden", false);
        // 초기화
        d3.select("#mini-lat-slider").property("value", 0);
        updateMiniSimulator(0);
    });

    d3.select("#btn-close-tissot-modal").on("click", () => {
        d3.select("#tissot-desc-modal").classed("hidden", true);
    });

    // 모달 바깥쪽 클릭 시 닫기
    d3.select("#tissot-desc-modal").on("click", function(event) {
        if (event.target === this) {
            d3.select(this).classed("hidden", true);
        }
    });

    // 미니 시뮬레이터 구동 리스너
    d3.select("#mini-lat-slider").on("input", function() {
        updateMiniSimulator(+this.value);
    });

    function updateMiniSimulator(lat) {
        d3.select("#mini-lat-val").text(`${lat}°`);
        const rad = lat * Math.PI / 180;
        const cosVal = Math.cos(rad);
        
        // 1. 등각도법 (메르카토르): 형태 유지, 위도 상승 시 크기 팽창
        const conformalScale = Math.min(3.5, 1 / cosVal);
        d3.select("#conformal-indicator")
            .style("transform", `scale(${conformalScale})`)
            .style("border-radius", "50%");
        const areaRatio = conformalScale * conformalScale;
        d3.select("#conformal-note").text(`면적: ${areaRatio.toFixed(1)}배 (원형 유지)`);

        // 2. 등적도법 (몰바이데): 면적 보존, 가로 수축 및 세로 신장으로 찌그러짐
        const eqWidth = Math.max(0.33, cosVal);
        const eqHeight = Math.min(3.0, 1 / cosVal);
        d3.select("#equalarea-indicator")
            .style("transform", `scale(${eqWidth}, ${eqHeight})`);
        const distortPct = Math.round((eqHeight / eqWidth - 1) * 100);
        d3.select("#equalarea-note").text(`찌그러짐: ${distortPct}% (면적 보존)`);

        // 3. 등거도법 (정거원통): 세로(남북) 1.0 고정 보존, 가로(동서) 시컨트 팽창
        const eqDistWidth = Math.min(3.5, 1 / cosVal);
        const eqDistHeight = 1.0;
        d3.select("#equidistant-indicator")
            .style("transform", `scale(${eqDistWidth}, ${eqDistHeight})`);
        d3.select("#equidistant-note").text(`가로: ${eqDistWidth.toFixed(1)}배 (남북 거리 보존)`);
    }

    // N. 시스템 개발 배경 및 정합성 모달 제어
    d3.select("#btn-show-bg-desc").on("click", () => {
        d3.select("#system-bg-modal").classed("hidden", false);
        // 슬라이더 초기화
        d3.select("#bg-lat-slider").property("value", 0);
        updateBgSimulator(0);
        
        // 클릭 도트 및 라벨 초기화
        d3.selectAll(".click-dot").style("display", "none");
        d3.select("#bg-conformal-status").text("[ 원 내부를 클릭해 보세요 ]").attr("class", "box-note");
        d3.select("#bg-equidistant-status").text("[ 원 내부를 클릭해 보세요 ]").attr("class", "box-note");
    });

    d3.select("#btn-close-bg-modal").on("click", () => {
        d3.select("#system-bg-modal").classed("hidden", true);
    });

    d3.select("#system-bg-modal").on("click", function(event) {
        if (event.target === this) {
            d3.select(this).classed("hidden", true);
        }
    });

    // 정합성 슬라이더 변경 리스너
    d3.select("#bg-lat-slider").on("input", function() {
        updateBgSimulator(+this.value);
    });

    function updateBgSimulator(lat) {
        d3.select("#bg-lat-val").text(`${lat}°` + (lat === 0 ? " (적도 부근)" : lat >= 60 ? " (고위도 극지방)" : " (중위도)"));
        const rad = lat * Math.PI / 180;
        const cosVal = Math.cos(rad);
        
        // 1. 위도 상승에 따른 비대칭 border-radius 모핑 연산 (달걀 뒤집어 놓은 형태 연출)
        // 0도일 때 50%, 75도일 때 50% 50% 32% 32% / 38% 38% 62% 62%
        const ratio = lat / 75;
        const bottomRadius = 50 - 18 * ratio;
        const topRadiusY = 50 - 12 * ratio;
        const bottomRadiusY = 50 + 12 * ratio;
        const borderRadiusStr = `50% 50% ${bottomRadius}% ${bottomRadius}% / ${topRadiusY}% ${topRadiusY}% ${bottomRadiusY}% ${bottomRadiusY}`;
        
        // 2. 보정 전 (등각도법 왜곡): 위도 상승 시 visual 원주가 북쪽 팽창 비대칭 달걀 형태로 스케일업
        const conformalScale = Math.min(3.5, 1 / cosVal);
        d3.select("#bg-visual-conformal")
            .style("transform", `translate(-50%, -50%) scale(${conformalScale})`)
            .style("border-radius", borderRadiusStr);

        // 3. 보정 후 (360도 전방위 동거리 정합): 스케일은 점선원과 포개어지도록 1.0 고정이되 형태는 달걀 모핑 유지
        d3.select("#bg-visual-equidistant")
            .style("transform", "translate(-50%, -50%) scale(1)")
            .style("border-radius", borderRadiusStr);
            
        // 4. 수학적 판정 한계 점선원도 동일하게 달걀 모핑 적용
        d3.selectAll(".math-limit-circle")
            .style("border-radius", borderRadiusStr);
            
        // 클릭 상태 초기화
        d3.selectAll(".click-dot").style("display", "none");
        d3.select("#bg-conformal-status").text("[ 원 내부를 클릭해 보세요 ]").attr("class", "box-note");
        d3.select("#bg-equidistant-status").text("[ 원 내부를 클릭해 보세요 ]").attr("class", "box-note");
    }

    // 클릭 판정 바인딩
    handleBgClick("#bg-conformal-click-area", true);
    handleBgClick("#bg-equidistant-click-area", false);

    function handleBgClick(areaId, isConformal) {
        const area = d3.select(areaId);
        const node = area.node();
        
        area.on("click", function(event) {
            if (event.target.id === "bg-lat-slider") return; // 슬라이더 방지
            
            const rect = node.getBoundingClientRect();
            const container = area.select(".circle-container");
            const cNode = container.node();
            const cRect = cNode.getBoundingClientRect();
            
            const cx = cRect.width / 2;
            const cy = cRect.height / 2;
            
            // 컨테이너 내 상대적 좌표
            const clickX = event.clientX - cRect.left;
            const clickY = event.clientY - cRect.top;
            
            // 유효 영역 제한
            if (clickX < 0 || clickX > cRect.width || clickY < 0 || clickY > cRect.height) return;

            const dot = area.select(".click-dot");
            dot.style("left", `${clickX}px`)
               .style("top", `${clickY}px`)
               .style("display", "block");
               
            const dist = Math.sqrt((clickX - cx) ** 2 + (clickY - cy) ** 2);
            const mathRadius = 20; // 실제 구면 기준의 기본 픽셀 반경
            
            const statusText = area.select(".box-note");
            
            // 달걀 뒤집어 놓은 비대칭 형태(Egg-shape)의 남북 팽창 오차 수학적 감안
            // dy = clickY - cy (음수면 북쪽/위쪽 클릭, 양수면 남쪽/아래쪽 클릭)
            // 메르카토르 상에서 북쪽은 팽창률이 늘어나고, 남쪽은 줄어들므로 (1 - dy/dist * skew) 로 모델링
            const lat = +d3.select("#bg-lat-slider").property("value");
            const skewRatio = (lat / 75) * 0.24; // 위도가 올라갈수록 최대 24%의 남북 비대칭성 발생
            
            const directionY = dist > 0 ? (clickY - cy) / dist : 0;
            
            // 1. 실제 구면 대원 연산 한계 영역 (위도 상승에 따라 달걀 모양으로 찌그러지는 경계)
            const currentMathLimit = mathRadius * (1 - directionY * skewRatio);
            const isMathIn = dist <= currentMathLimit;

            if (isConformal) {
                // 2. 보정 전 (도법 왜곡 표출): 스케일 자체가 팽창하면서 달걀 형태로 커진 경계
                const conformalScale = Math.min(3.5, 1 / Math.cos(lat * Math.PI / 180));
                const currentVisualLimit = mathRadius * conformalScale * (1 - directionY * skewRatio);
                const isVisualIn = dist <= currentVisualLimit;
                
                if (isVisualIn && !isMathIn) {
                    statusText.html("❌ 불일치: 표출 포함 / 분석 제외 (왜곡 오류)")
                              .attr("class", "box-note status-mismatch");
                } else if (isVisualIn && isMathIn) {
                    statusText.html("✅ 일치: 표출 포함 / 분석 포함 (정합)")
                              .attr("class", "box-note status-match");
                } else {
                    statusText.html("✅ 일치: 표출 제외 / 분석 제외 (정합)")
                              .attr("class", "box-note status-match");
                }
            } else {
                // 3. 보정 후 (360도 동거리 정합): 표출 경계가 실제 분석 경계(달걀 형상 점선)와 항상 100% 동일함
                const isVisualIn = dist <= currentMathLimit;
                if (isVisualIn && isMathIn) {
                    statusText.html("✅ 일치: 표출 포함 / 분석 포함 (정합)")
                              .attr("class", "box-note status-match");
                } else {
                    statusText.html("✅ 일치: 표출 제외 / 분석 제외 (정합)")
                              .attr("class", "box-note status-match");
                }
            }
        });
    }
}
